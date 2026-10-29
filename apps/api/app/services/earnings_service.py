"""Ingresos de médicos, payouts y conciliación interna."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.payment import (
    ConsultationCharge,
    ConsultationChargeStatus,
    DoctorEarning,
    DoctorEarningStatus,
    PaymentTransaction,
    PaymentTransactionStatus,
    PaymentTransactionType,
    Payout,
    PayoutStatus,
)
from app.services.payments.factory import get_payment_provider

logger = get_logger(__name__)


class EarningsError(Exception):
    pass


class EarningsService:
    def summary(self, db: Session, doctor_id: int) -> dict:
        rows = (
            db.query(DoctorEarning.status, func.coalesce(func.sum(DoctorEarning.net_cents), 0))
            .filter(DoctorEarning.doctor_id == doctor_id)
            .group_by(DoctorEarning.status)
            .all()
        )
        amounts = {status.value: int(total) for status, total in rows}
        return {
            "pending_cents": amounts.get(DoctorEarningStatus.pending.value, 0),
            "available_cents": amounts.get(DoctorEarningStatus.available.value, 0),
            "paid_cents": amounts.get(DoctorEarningStatus.paid.value, 0),
            "currency": settings.PAYMENT_CURRENCY,
        }

    def list_earnings(self, db: Session, doctor_id: int, limit: int = 100) -> list[DoctorEarning]:
        return (
            db.query(DoctorEarning)
            .filter(DoctorEarning.doctor_id == doctor_id)
            .order_by(DoctorEarning.created_at.desc())
            .limit(limit)
            .all()
        )

    def list_payouts(self, db: Session, doctor_id: int | None = None, limit: int = 100) -> list[Payout]:
        query = db.query(Payout)
        if doctor_id is not None:
            query = query.filter(Payout.doctor_id == doctor_id)
        return query.order_by(Payout.requested_at.desc()).limit(limit).all()

    def _available_earnings(self, db: Session, doctor_id: int) -> list[DoctorEarning]:
        return (
            db.query(DoctorEarning)
            .filter(
                DoctorEarning.doctor_id == doctor_id,
                DoctorEarning.status == DoctorEarningStatus.available,
            )
            .order_by(DoctorEarning.available_at.asc(), DoctorEarning.id.asc())
            .with_for_update()
            .all()
        )

    def request_payout(self, db: Session, doctor_id: int, amount_cents: int | None = None) -> Payout:
        earnings = self._available_earnings(db, doctor_id)
        available = sum(item.net_cents or 0 for item in earnings)
        amount = amount_cents if amount_cents is not None else available
        if amount <= 0:
            raise EarningsError("No hay ingresos disponibles para retirar.")
        if amount > available:
            raise EarningsError("El monto solicitado supera los ingresos disponibles.")

        provider = get_payment_provider()
        payout = Payout(
            doctor_id=doctor_id,
            amount_cents=amount,
            currency=settings.PAYMENT_CURRENCY,
            provider=provider.name,
            status=PayoutStatus.processing,
        )
        db.add(payout)
        db.flush()

        remaining = amount
        for earning in earnings:
            if remaining <= 0:
                break
            if (earning.net_cents or 0) <= remaining:
                earning.status = DoctorEarningStatus.paid
                earning.payout_id = payout.id
                remaining -= earning.net_cents or 0
            else:
                # No se divide un earning entre payouts: se deja para el siguiente.
                break
        if remaining > 0:
            db.rollback()
            raise EarningsError("No se pudo asignar el monto completo a ingresos disponibles.")

        db.commit()
        db.refresh(payout)

        try:
            result = provider.create_payout(
                doctor_id=doctor_id,
                amount_cents=amount,
                currency=settings.PAYMENT_CURRENCY,
                idempotency_key=f"payout-{payout.id}-{uuid.uuid4().hex[:8]}",
            )
        except Exception as error:
            payout.status = PayoutStatus.failed
            payout.failure_reason = str(error)
            db.query(DoctorEarning).filter(DoctorEarning.payout_id == payout.id).update(
                {DoctorEarning.status: DoctorEarningStatus.available, DoctorEarning.payout_id: None}
            )
            db.commit()
            raise EarningsError("No se pudo procesar el payout.") from error

        payout.provider_reference = result.reference
        payout.status = PayoutStatus.paid if result.status == "paid" else PayoutStatus.failed
        payout.processed_at = datetime.now(UTC)
        if payout.status == PayoutStatus.failed:
            payout.failure_reason = result.failure_message or "Payout rechazado"
            db.query(DoctorEarning).filter(DoctorEarning.payout_id == payout.id).update(
                {DoctorEarning.status: DoctorEarningStatus.available, DoctorEarning.payout_id: None}
            )
        db.commit()
        db.refresh(payout)
        if payout.status == PayoutStatus.failed:
            raise EarningsError(payout.failure_reason or "Payout rechazado")
        return payout

    def retry_payout(self, db: Session, payout_id: int) -> Payout:
        payout = db.query(Payout).filter(Payout.id == payout_id).first()
        if payout is None:
            raise EarningsError("Payout no encontrado.")
        if payout.status != PayoutStatus.failed:
            raise EarningsError("Solo se pueden reintentar payouts fallidos.")
        # Vuelve a reservar los ingresos y crea un intento nuevo.
        earnings = self._available_earnings(db, payout.doctor_id)
        amount = payout.amount_cents
        if sum(item.net_cents or 0 for item in earnings) < amount:
            raise EarningsError("No hay ingresos disponibles suficientes para reintentar.")
        remaining = amount
        for earning in earnings:
            if remaining <= 0:
                break
            if (earning.net_cents or 0) <= remaining:
                earning.status = DoctorEarningStatus.paid
                earning.payout_id = payout.id
                remaining -= earning.net_cents or 0
        if remaining > 0:
            db.rollback()
            raise EarningsError("No se pudo asignar el monto completo.")
        payout.status = PayoutStatus.processing
        payout.failure_reason = None
        db.commit()

        provider = get_payment_provider()
        result = provider.create_payout(
            doctor_id=payout.doctor_id,
            amount_cents=payout.amount_cents,
            currency=payout.currency,
            idempotency_key=f"payout-{payout.id}-retry-{uuid.uuid4().hex[:8]}",
        )
        payout.provider_reference = result.reference
        payout.status = PayoutStatus.paid if result.status == "paid" else PayoutStatus.failed
        payout.processed_at = datetime.now(UTC)
        if payout.status == PayoutStatus.failed:
            payout.failure_reason = result.failure_message or "Payout rechazado"
            db.query(DoctorEarning).filter(DoctorEarning.payout_id == payout.id).update(
                {DoctorEarning.status: DoctorEarningStatus.available, DoctorEarning.payout_id: None}
            )
        db.commit()
        db.refresh(payout)
        if payout.status == PayoutStatus.failed:
            raise EarningsError(payout.failure_reason or "Payout rechazado")
        return payout

    def reconcile(self, db: Session) -> dict:
        charges = (
            db.query(ConsultationCharge)
            .filter(ConsultationCharge.status == ConsultationChargeStatus.paid)
            .all()
        )
        missing_earnings: list[int] = []
        amount_mismatches: list[dict] = []
        missing_transactions: list[int] = []
        for charge in charges:
            earning = (
                db.query(DoctorEarning)
                .filter(DoctorEarning.appointment_id == charge.appointment_id)
                .first()
            )
            if earning is None:
                missing_earnings.append(charge.appointment_id)
            elif (
                earning.gross_cents != (charge.paid_amount_cents or 0)
                or earning.platform_fee_cents != (charge.platform_fee_cents or 0)
                or earning.net_cents != (charge.doctor_net_cents or 0)
            ):
                amount_mismatches.append(
                    {
                        "appointment_id": charge.appointment_id,
                        "charge": {
                            "gross": charge.paid_amount_cents,
                            "fee": charge.platform_fee_cents,
                            "net": charge.doctor_net_cents,
                        },
                        "earning": {
                            "gross": earning.gross_cents,
                            "fee": earning.platform_fee_cents,
                            "net": earning.net_cents,
                        },
                    }
                )
            transactions = (
                db.query(PaymentTransaction)
                .filter(
                    PaymentTransaction.appointment_id == charge.appointment_id,
                    PaymentTransaction.status == PaymentTransactionStatus.succeeded,
                    PaymentTransaction.type.in_(
                        [PaymentTransactionType.initial, PaymentTransactionType.extension]
                    ),
                )
                .all()
            )
            if not transactions:
                missing_transactions.append(charge.appointment_id)
            elif sum(tx.amount_cents for tx in transactions) != (charge.paid_amount_cents or 0):
                amount_mismatches.append(
                    {
                        "appointment_id": charge.appointment_id,
                        "reason": "transactions_total",
                        "transactions": sum(tx.amount_cents for tx in transactions),
                        "charge": charge.paid_amount_cents,
                    }
                )
        return {
            "ok": not missing_earnings and not amount_mismatches and not missing_transactions,
            "checked_charges": len(charges),
            "missing_earnings": missing_earnings,
            "amount_mismatches": amount_mismatches,
            "missing_transactions": missing_transactions,
        }


earnings_service = EarningsService()
