"""Consulta y agregación de la información financiera para el panel de admin.

No mueve dinero: solo lee el libro de movimientos de los monederos
(``wallet_transactions``), las citas liquidadas (``appointment_payments``),
las recargas y los retiros. La comisión de la plataforma se calcula por cita y
queda registrada en ``appointment_payments.platform_fee_cents``.
"""

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.doctor_profile import DoctorProfile
from app.models.user import User
from app.models.wallet import (
    AppointmentPayment,
    AppointmentPaymentStatus,
    Wallet,
    WalletTransaction,
    WalletTransactionType,
    Withdrawal,
    WithdrawalStatus,
)

_INFLOW_TYPES = {
    WalletTransactionType.topup,
    WalletTransactionType.consultation_payment,
}
_OUTFLOW_TYPES = {
    WalletTransactionType.consultation_income,
    WalletTransactionType.refund,
    WalletTransactionType.withdrawal,
}


class FinanceService:
    # ------------------------------------------------------------------
    # Política de comisiones (para médicos y frontend)
    # ------------------------------------------------------------------
    def policy(self) -> dict:
        return {
            "platform_fee_bps": settings.PLATFORM_FEE_BPS,
            "platform_fee_percent": round(settings.PLATFORM_FEE_BPS / 100, 2),
            "min_price_cents": settings.VIDEO_PRICE_MIN_CENTS,
            "max_price_cents": settings.VIDEO_PRICE_MAX_CENTS,
            "currency": settings.CREDITS_CURRENCY,
            "is_mock_money": not settings.STRIPE_SECRET_KEY,
        }

    # ------------------------------------------------------------------
    # Resumen
    # ------------------------------------------------------------------
    def overview(
        self,
        db: Session,
        *,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> dict:
        payments_query = db.query(AppointmentPayment).filter(
            AppointmentPayment.status == AppointmentPaymentStatus.released
        )
        if start is not None:
            payments_query = payments_query.filter(AppointmentPayment.released_at >= start)
        if end is not None:
            payments_query = payments_query.filter(AppointmentPayment.released_at <= end)

        gmv_cents, fee_cents, payout_cents, completed_count = payments_query.with_entities(
            func.coalesce(
                func.sum(func.coalesce(AppointmentPayment.billable_amount_cents, AppointmentPayment.amount_cents)),
                0,
            ),
            func.coalesce(func.sum(AppointmentPayment.platform_fee_cents), 0),
            func.coalesce(func.sum(AppointmentPayment.doctor_amount_cents), 0),
            func.count(AppointmentPayment.id),
        ).one()

        topups = self._sum_wallet_transactions(
            db, WalletTransactionType.topup, start=start, end=end
        )
        refunds = self._sum_wallet_transactions(
            db, WalletTransactionType.refund, start=start, end=end
        )

        paid_query = db.query(func.coalesce(func.sum(Withdrawal.amount_cents), 0)).filter(
            Withdrawal.status == WithdrawalStatus.paid
        )
        if start is not None:
            paid_query = paid_query.filter(Withdrawal.processed_at >= start)
        if end is not None:
            paid_query = paid_query.filter(Withdrawal.processed_at <= end)
        withdrawals_paid = int(paid_query.scalar() or 0)

        withdrawals_processing = int(
            db.query(func.coalesce(func.sum(Withdrawal.amount_cents), 0))
            .filter(
                Withdrawal.status.in_(
                    [WithdrawalStatus.processing, WithdrawalStatus.pending]
                )
            )
            .scalar()
            or 0
        )
        withdrawals_failed = int(
            db.query(func.coalesce(func.sum(Withdrawal.amount_cents), 0))
            .filter(Withdrawal.status == WithdrawalStatus.failed)
            .scalar()
            or 0
        )

        held_cents = int(
            db.query(
                func.coalesce(
                    func.sum(AppointmentPayment.amount_cents + AppointmentPayment.overtime_amount_cents),
                    0,
                )
            )
            .filter(AppointmentPayment.status == AppointmentPaymentStatus.held)
            .scalar()
            or 0
        )
        user_balances = int(
            db.query(func.coalesce(func.sum(Wallet.balance_cents), 0)).scalar() or 0
        )
        doctor_balances = int(
            db.query(func.coalesce(func.sum(Wallet.balance_cents), 0))
            .join(DoctorProfile, DoctorProfile.user_id == Wallet.user_id)
            .scalar()
            or 0
        )

        return {
            "start": start,
            "end": end,
            "currency": settings.CREDITS_CURRENCY,
            "platform_fee_bps": settings.PLATFORM_FEE_BPS,
            "platform_fee_percent": round(settings.PLATFORM_FEE_BPS / 100, 2),
            "is_mock_money": not settings.STRIPE_SECRET_KEY,
            "gmv_cents": int(gmv_cents or 0),
            "platform_revenue_cents": int(fee_cents or 0),
            "doctor_payouts_cents": int(payout_cents or 0),
            "completed_count": int(completed_count or 0),
            "topups_cents": topups,
            "refunds_cents": refunds,
            "withdrawals_paid_cents": withdrawals_paid,
            "withdrawals_processing_cents": withdrawals_processing,
            "withdrawals_failed_cents": withdrawals_failed,
            "held_cents": held_cents,
            "user_balances_cents": user_balances,
            "doctor_balances_cents": doctor_balances,
        }

    def _sum_wallet_transactions(
        self,
        db: Session,
        tx_type: WalletTransactionType,
        *,
        start: datetime | None,
        end: datetime | None,
    ) -> int:
        query = db.query(func.coalesce(func.sum(WalletTransaction.amount_cents), 0)).filter(
            WalletTransaction.type == tx_type
        )
        if start is not None:
            query = query.filter(WalletTransaction.created_at >= start)
        if end is not None:
            query = query.filter(WalletTransaction.created_at <= end)
        return int(query.scalar() or 0)

    # ------------------------------------------------------------------
    # Movimientos (ingresos y salidas)
    # ------------------------------------------------------------------
    def movements(
        self,
        db: Session,
        *,
        movement_type: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        query = db.query(WalletTransaction).options(joinedload(WalletTransaction.wallet))
        if movement_type:
            query = query.filter(WalletTransaction.type == movement_type)
        if start is not None:
            query = query.filter(WalletTransaction.created_at >= start)
        if end is not None:
            query = query.filter(WalletTransaction.created_at <= end)
        if search:
            like = f"%{search}%"
            query = query.join(User, User.id == WalletTransaction.user_id).filter(
                User.email.ilike(like)
            )

        total = query.count()
        rows = (
            query.order_by(WalletTransaction.created_at.desc(), WalletTransaction.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        user_ids = {row.user_id for row in rows}
        users = {
            user.id: user
            for user in db.query(User).filter(User.id.in_(user_ids)).all()
        } if user_ids else {}

        items = []
        inflow_cents = 0
        outflow_cents = 0
        for row in rows:
            direction = self._direction(row)
            if direction == "in":
                inflow_cents += abs(row.amount_cents)
            else:
                outflow_cents += abs(row.amount_cents)
            user = users.get(row.user_id)
            items.append(
                {
                    "id": row.id,
                    "created_at": row.created_at,
                    "type": row.type.value if hasattr(row.type, "value") else str(row.type),
                    "direction": direction,
                    "amount_cents": abs(row.amount_cents),
                    "status": row.status.value if hasattr(row.status, "value") else str(row.status),
                    "description": row.description,
                    "actor_email": user.email if user else None,
                    "actor_role": (
                        (user.primary_role.value) if user else None
                    ),
                    "reference_type": row.reference_type,
                    "reference_id": row.reference_id,
                }
            )

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "inflow_cents": inflow_cents,
            "outflow_cents": outflow_cents,
        }

    @staticmethod
    def _direction(row: WalletTransaction) -> str:
        if row.type in _INFLOW_TYPES:
            return "in"
        if row.type in _OUTFLOW_TYPES:
            return "out"
        # Ajustes manuales: el signo del monto define la dirección.
        return "in" if row.amount_cents >= 0 else "out"

    # ------------------------------------------------------------------
    # Comisiones
    # ------------------------------------------------------------------
    def commissions(
        self,
        db: Session,
        *,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        query = (
            db.query(AppointmentPayment)
            .options(
                joinedload(AppointmentPayment.doctor).joinedload(DoctorProfile.user),
                joinedload(AppointmentPayment.patient),
            )
            .filter(AppointmentPayment.status == AppointmentPaymentStatus.released)
        )
        if start is not None:
            query = query.filter(AppointmentPayment.released_at >= start)
        if end is not None:
            query = query.filter(AppointmentPayment.released_at <= end)

        total = query.count()
        totals = query.with_entities(
            func.coalesce(
                func.sum(func.coalesce(AppointmentPayment.billable_amount_cents, AppointmentPayment.amount_cents)),
                0,
            ),
            func.coalesce(func.sum(AppointmentPayment.platform_fee_cents), 0),
            func.coalesce(func.sum(AppointmentPayment.doctor_amount_cents), 0),
        ).one()

        rows = (
            query.order_by(AppointmentPayment.released_at.desc(), AppointmentPayment.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        items = []
        for payment in rows:
            doctor = payment.doctor
            items.append(
                {
                    "appointment_payment_id": payment.id,
                    "appointment_id": payment.appointment_id,
                    "released_at": payment.released_at,
                    "doctor_profile_id": payment.doctor_id,
                    "doctor_name": doctor.display_name if doctor else "Médico",
                    "doctor_email": doctor.user.email if doctor and doctor.user else None,
                    "patient_email": payment.patient.email if payment.patient else None,
                    "billable_seconds": payment.billable_seconds or 0,
                    "gross_cents": payment.billable_amount_cents or payment.amount_cents,
                    "fee_cents": payment.platform_fee_cents or 0,
                    "net_cents": payment.doctor_amount_cents or 0,
                }
            )

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "gross_cents": int(totals[0] or 0),
            "fee_cents": int(totals[1] or 0),
            "net_cents": int(totals[2] or 0),
            "platform_fee_percent": round(settings.PLATFORM_FEE_BPS / 100, 2),
        }


finance_service = FinanceService()
