"""Consulta y agregación de la información financiera para el panel de admin.

No mueve dinero: solo lee los cargos confirmados, las transacciones de pago,
los ingresos de médicos y los payouts del sistema actual.
"""

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.appointment import Appointment
from app.models.doctor_profile import DoctorProfile
from app.models.payment import (
    ConsultationCharge,
    ConsultationChargeStatus,
    DoctorEarning,
    DoctorEarningStatus,
    PaymentTransaction,
    PaymentTransactionStatus,
    Payout,
    PayoutStatus,
)
from app.models.user import User


class FinanceService:
    def policy(self) -> dict:
        return {
            "platform_fee_bps": settings.PLATFORM_FEE_BPS,
            "platform_fee_percent": round(settings.PLATFORM_FEE_BPS / 100, 2),
            "min_price_cents": settings.VIDEO_PRICE_MIN_CENTS,
            "max_price_cents": settings.VIDEO_PRICE_MAX_CENTS,
            "currency": settings.PAYMENT_CURRENCY,
        }

    def overview(
        self,
        db: Session,
        *,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> dict:
        charges_query = db.query(ConsultationCharge).filter(
            ConsultationCharge.status == ConsultationChargeStatus.paid
        )
        if start is not None:
            charges_query = charges_query.filter(ConsultationCharge.updated_at >= start)
        if end is not None:
            charges_query = charges_query.filter(ConsultationCharge.updated_at <= end)

        gmv_cents, fee_cents, doctor_net_cents, paid_count = charges_query.with_entities(
            func.coalesce(func.sum(ConsultationCharge.paid_amount_cents), 0),
            func.coalesce(func.sum(ConsultationCharge.platform_fee_cents), 0),
            func.coalesce(func.sum(ConsultationCharge.doctor_net_cents), 0),
            func.count(ConsultationCharge.id),
        ).one()

        pending_charges_cents = int(
            db.query(func.coalesce(func.sum(ConsultationCharge.quoted_amount_cents), 0))
            .filter(ConsultationCharge.status == ConsultationChargeStatus.pending)
            .scalar()
            or 0
        )
        pending_earnings_cents = int(
            db.query(func.coalesce(func.sum(DoctorEarning.net_cents), 0))
            .filter(
                DoctorEarning.status.in_(
                    [DoctorEarningStatus.pending, DoctorEarningStatus.available]
                )
            )
            .scalar()
            or 0
        )

        payouts_paid = self._sum_payouts(db, PayoutStatus.paid, start=start, end=end)
        payouts_processing = self._sum_payouts(
            db, PayoutStatus.processing, start=start, end=end
        )
        payouts_failed = self._sum_payouts(db, PayoutStatus.failed, start=start, end=end)

        return {
            "start": start,
            "end": end,
            "currency": settings.PAYMENT_CURRENCY,
            "platform_fee_bps": settings.PLATFORM_FEE_BPS,
            "platform_fee_percent": round(settings.PLATFORM_FEE_BPS / 100, 2),
            "gmv_cents": int(gmv_cents or 0),
            "platform_revenue_cents": int(fee_cents or 0),
            "doctor_net_cents": int(doctor_net_cents or 0),
            "paid_consultations": int(paid_count or 0),
            "pending_charges_cents": pending_charges_cents,
            "pending_earnings_cents": pending_earnings_cents,
            "payouts_paid_cents": payouts_paid,
            "payouts_processing_cents": payouts_processing,
            "payouts_failed_cents": payouts_failed,
        }

    def _sum_payouts(
        self,
        db: Session,
        status: PayoutStatus,
        *,
        start: datetime | None,
        end: datetime | None,
    ) -> int:
        query = db.query(func.coalesce(func.sum(Payout.amount_cents), 0)).filter(
            Payout.status == status
        )
        if start is not None:
            query = query.filter(Payout.requested_at >= start)
        if end is not None:
            query = query.filter(Payout.requested_at <= end)
        return int(query.scalar() or 0)

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
        query = db.query(PaymentTransaction, User).join(
            User, User.id == PaymentTransaction.user_id
        )
        if movement_type:
            query = query.filter(PaymentTransaction.type == movement_type)
        if start is not None:
            query = query.filter(PaymentTransaction.created_at >= start)
        if end is not None:
            query = query.filter(PaymentTransaction.created_at <= end)
        if search:
            query = query.filter(User.email.ilike(f"%{search}%"))

        total = query.count()
        rows = (
            query.order_by(PaymentTransaction.created_at.desc(), PaymentTransaction.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        items = []
        inflow_cents = 0
        outflow_cents = 0
        for transaction, user in rows:
            is_inflow = transaction.type.value in {"initial", "extension"}
            if is_inflow:
                inflow_cents += abs(transaction.amount_cents)
            else:
                outflow_cents += abs(transaction.amount_cents)
            items.append(
                {
                    "id": transaction.id,
                    "created_at": transaction.created_at,
                    "type": transaction.type.value,
                    "direction": "in" if is_inflow else "out",
                    "amount_cents": abs(transaction.amount_cents),
                    "status": transaction.status.value,
                    "description": (
                        f"Cobro de cita #{transaction.appointment_id}"
                        if transaction.appointment_id
                        else "Movimiento de pago"
                    ),
                    "actor_email": user.email if user else None,
                    "actor_role": user.primary_role.value if user else None,
                    "reference_type": "appointment" if transaction.appointment_id else None,
                    "reference_id": transaction.appointment_id,
                    "provider": transaction.provider,
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
            db.query(ConsultationCharge, Appointment, DoctorProfile, User)
            .join(Appointment, Appointment.id == ConsultationCharge.appointment_id)
            .join(DoctorProfile, DoctorProfile.id == ConsultationCharge.doctor_id)
            .outerjoin(User, User.id == ConsultationCharge.patient_id)
            .filter(ConsultationCharge.status == ConsultationChargeStatus.paid)
        )
        if start is not None:
            query = query.filter(ConsultationCharge.updated_at >= start)
        if end is not None:
            query = query.filter(ConsultationCharge.updated_at <= end)

        total = query.count()
        rows = (
            query.order_by(ConsultationCharge.updated_at.desc(), ConsultationCharge.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        items = []
        gross_cents = 0
        fee_cents = 0
        net_cents = 0
        for charge, appointment, doctor, patient in rows:
            gross = charge.paid_amount_cents or 0
            fee = charge.platform_fee_cents or 0
            net = charge.doctor_net_cents or 0
            gross_cents += gross
            fee_cents += fee
            net_cents += net
            items.append(
                {
                    "charge_id": charge.id,
                    "appointment_id": charge.appointment_id,
                    "released_at": charge.updated_at,
                    "doctor_profile_id": charge.doctor_id,
                    "doctor_name": doctor.display_name if doctor else "Médico",
                    "doctor_email": doctor.user.email if doctor and doctor.user else None,
                    "patient_email": patient.email if patient else None,
                    "paid_minutes": charge.paid_minutes or 0,
                    "gross_cents": gross,
                    "fee_cents": fee,
                    "net_cents": net,
                    "status": charge.status.value,
                }
            )

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "gross_cents": gross_cents,
            "fee_cents": fee_cents,
            "net_cents": net_cents,
            "platform_fee_percent": round(settings.PLATFORM_FEE_BPS / 100, 2),
        }


finance_service = FinanceService()
