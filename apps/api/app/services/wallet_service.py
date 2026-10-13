from datetime import UTC, datetime

import math

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.video_session import VideoSession
from app.models.wallet import (
    AppointmentPayment,
    AppointmentPaymentStatus,
    Wallet,
    WalletTransaction,
    WalletTransactionStatus,
    WalletTransactionType,
    Withdrawal,
    WithdrawalStatus,
)
from app.services.payout_service import payout_service
from app.services.pricing_service import pricing_service

logger = get_logger(__name__)


def cents_to_credits(amount_cents: int) -> float:
    """1 crédito = 1 USD = 100 centavos."""
    return round(amount_cents / 100, 2)


class WalletService:
    """Monedero de créditos con libro de movimientos (ledger).

    Todas las operaciones trabajan en centavos y bloquean el monedero
    (`SELECT ... FOR UPDATE`) para evitar saldos negativos por concurrencia.
    Las operaciones no hacen commit: el llamador controla la transacción.
    """

    @staticmethod
    def platform_fee_cents(amount_cents: int) -> int:
        """Comisión de la plataforma sobre un monto bruto (redondeo hacia abajo)."""
        if amount_cents <= 0:
            return 0
        return amount_cents * settings.PLATFORM_FEE_BPS // 10000

    @staticmethod
    def doctor_net_cents(amount_cents: int) -> int:
        """Lo que recibe el médico tras descontar la comisión de la plataforma."""
        return max(0, amount_cents - WalletService.platform_fee_cents(amount_cents))

    @staticmethod
    def platform_fee_percent() -> float:
        return round(settings.PLATFORM_FEE_BPS / 100, 2)

    def doctor_income_summary(self, db: Session, doctor_profile_id: int) -> dict:
        """Totales históricos de ingresos del médico, con bruto/comisión/neto.

        Se calculan sobre citas ya liquidadas (``released``), que son las que
        generaron el ingreso efectivo al monedero del médico.
        """
        row = (
            db.query(
                func.coalesce(func.sum(AppointmentPayment.billable_amount_cents), 0),
                func.coalesce(func.sum(AppointmentPayment.platform_fee_cents), 0),
                func.coalesce(func.sum(AppointmentPayment.doctor_amount_cents), 0),
                func.count(AppointmentPayment.id),
            )
            .filter(
                AppointmentPayment.doctor_id == doctor_profile_id,
                AppointmentPayment.status == AppointmentPaymentStatus.released,
            )
            .one()
        )
        gross_cents = int(row[0] or 0)
        fee_cents = int(row[1] or 0)
        net_cents = int(row[2] or 0)
        count = int(row[3] or 0)
        return {
            "gross_income_cents": gross_cents,
            "platform_fee_cents": fee_cents,
            "net_income_cents": net_cents,
            "completed_count": count,
        }

    def get_or_create_wallet(self, db: Session, user_id: int) -> Wallet:
        wallet = (
            db.query(Wallet)
            .filter(Wallet.user_id == user_id)
            .with_for_update()
            .first()
        )
        if wallet:
            return wallet
        wallet = Wallet(user_id=user_id, balance_cents=0)
        db.add(wallet)
        db.flush()
        return wallet

    def get_balance_cents(self, db: Session, user_id: int) -> int:
        wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
        return wallet.balance_cents if wallet else 0

    def _apply(
        self,
        db: Session,
        wallet: Wallet,
        *,
        amount_cents: int,
        tx_type: WalletTransactionType,
        description: str,
        reference_type: str | None = None,
        reference_id: int | None = None,
        tx_status: WalletTransactionStatus = WalletTransactionStatus.completed,
    ) -> WalletTransaction:
        wallet.balance_cents = (wallet.balance_cents or 0) + amount_cents
        transaction = WalletTransaction(
            wallet_id=wallet.id,
            user_id=wallet.user_id,
            type=tx_type,
            status=tx_status,
            amount_cents=amount_cents,
            balance_after_cents=wallet.balance_cents,
            description=description,
            reference_type=reference_type,
            reference_id=reference_id,
        )
        db.add(transaction)
        db.flush()
        return transaction

    # --- Recargas y retiros -------------------------------------------------

    def topup(self, db: Session, user_id: int, amount_cents: int) -> WalletTransaction:
        if amount_cents < settings.WALLET_MIN_TOPUP_CENTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La recarga mínima es de {cents_to_credits(settings.WALLET_MIN_TOPUP_CENTS)} créditos",
            )
        if amount_cents > settings.WALLET_MAX_TOPUP_CENTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La recarga máxima es de {cents_to_credits(settings.WALLET_MAX_TOPUP_CENTS)} créditos",
            )
        wallet = self.get_or_create_wallet(db, user_id)
        logger.info(f"Wallet topup: user_id={user_id}, amount_cents={amount_cents}")
        return self._apply(
            db,
            wallet,
            amount_cents=amount_cents,
            tx_type=WalletTransactionType.topup,
            description="Recarga de créditos (prueba)",
        )

    def request_withdrawal(
        self,
        db: Session,
        user_id: int,
        amount_cents: int,
        destination: str,
    ) -> Withdrawal:
        if amount_cents < settings.WALLET_MIN_WITHDRAWAL_CENTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El retiro mínimo es de {cents_to_credits(settings.WALLET_MIN_WITHDRAWAL_CENTS)} créditos",
            )
        wallet = self.get_or_create_wallet(db, user_id)
        if (wallet.balance_cents or 0) < amount_cents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No tienes créditos suficientes para este retiro",
            )

        withdrawal = Withdrawal(
            user_id=user_id,
            amount_cents=amount_cents,
            destination=destination,
            status=WithdrawalStatus.processing,
            provider=payout_service.provider_name,
        )
        db.add(withdrawal)
        db.flush()

        # El monto se descuenta al solicitar. Si el proveedor confirma el envío
        # pasa a ``completed``; si falla, se reembolsa (transacción ``reversed``).
        transaction = self._apply(
            db,
            wallet,
            amount_cents=-amount_cents,
            tx_type=WalletTransactionType.withdrawal,
            description=f"Retiro #{withdrawal.id}",
            reference_type="withdrawal",
            reference_id=withdrawal.id,
            tx_status=WalletTransactionStatus.pending,
        )

        try:
            result = payout_service.create_payout(withdrawal)
        except Exception as exc:  # pragma: no cover - depende del proveedor
            logger.error(
                f"Payout no pudo iniciarse para withdrawal #{withdrawal.id}: {exc}",
                exc_info=True,
            )
            # La transacción completa (débito + retiro) se revierte: si la
            # pasarela no aceptó la solicitud, no se cobra nada al usuario.
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No se pudo procesar el retiro con la pasarela de pagos. Intenta de nuevo.",
            ) from exc

        withdrawal.provider_reference = result.reference or withdrawal.provider_reference
        if result.status == "paid":
            self._confirm_withdrawal(db, withdrawal, transaction)
        else:
            db.flush()

        logger.info(
            f"Withdrawal {withdrawal.status.value}: id={withdrawal.id}, "
            f"user_id={user_id}, amount_cents={amount_cents}, provider={withdrawal.provider}"
        )
        return withdrawal

    def _withdrawal_transaction(self, db: Session, withdrawal_id: int) -> WalletTransaction | None:
        return (
            db.query(WalletTransaction)
            .filter(
                WalletTransaction.reference_type == "withdrawal",
                WalletTransaction.reference_id == withdrawal_id,
                WalletTransaction.type == WalletTransactionType.withdrawal,
            )
            .first()
        )

    def _confirm_withdrawal(
        self,
        db: Session,
        withdrawal: Withdrawal,
        transaction: WalletTransaction | None = None,
    ) -> None:
        withdrawal.status = WithdrawalStatus.paid
        withdrawal.processed_at = withdrawal.processed_at or datetime.now(UTC)
        transaction = transaction or self._withdrawal_transaction(db, withdrawal.id)
        if transaction is not None:
            transaction.status = WalletTransactionStatus.completed
        db.flush()

    def _fail_withdrawal(
        self,
        db: Session,
        withdrawal: Withdrawal,
        transaction: WalletTransaction | None,
        *,
        reason: str,
    ) -> None:
        withdrawal.status = WithdrawalStatus.failed
        withdrawal.failure_reason = reason
        withdrawal.processed_at = datetime.now(UTC)
        transaction = transaction or self._withdrawal_transaction(db, withdrawal.id)
        if transaction is not None:
            transaction.status = WalletTransactionStatus.reversed
        wallet = self.get_or_create_wallet(db, withdrawal.user_id)
        self._apply(
            db,
            wallet,
            amount_cents=withdrawal.amount_cents,
            tx_type=WalletTransactionType.refund,
            description=f"Retiro #{withdrawal.id} fallido",
            reference_type="withdrawal",
            reference_id=withdrawal.id,
        )
        db.flush()

    def handle_payout_event(
        self,
        db: Session,
        *,
        provider_reference: str,
        status: str,
        failure_reason: str | None = None,
    ) -> Withdrawal | None:
        """Aplica el webhook del proveedor. Idempotente por referencia externa."""
        withdrawal = (
            db.query(Withdrawal)
            .filter(Withdrawal.provider_reference == provider_reference)
            .with_for_update()
            .first()
        )
        if withdrawal is None:
            return None
        # Si ya está resuelto no se vuelve a aplicar (reintentos del webhook).
        if withdrawal.status in {
            WithdrawalStatus.paid,
            WithdrawalStatus.failed,
            WithdrawalStatus.rejected,
        }:
            return withdrawal

        if status == "paid":
            self._confirm_withdrawal(db, withdrawal)
        elif status in {"failed", "canceled", "cancelled"}:
            self._fail_withdrawal(
                db,
                withdrawal,
                None,
                reason=failure_reason or "El proveedor rechazó el retiro",
            )
        else:
            return withdrawal
        db.flush()
        return withdrawal

    # --- Pagos de citas -----------------------------------------------------

    def appointment_amount_cents(self, appointment) -> int:
        if appointment.doctor is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cita no tiene médico asignado")
        price_per_min = appointment.doctor.price_per_min_cents
        pricing_service.validate_price_per_minute(price_per_min)
        return max(0, appointment.duration_minutes) * price_per_min

    def charge_appointment(self, db: Session, appointment, amount_cents: int) -> AppointmentPayment:
        existing = (
            db.query(AppointmentPayment)
            .filter(AppointmentPayment.appointment_id == appointment.id)
            .with_for_update()
            .first()
        )
        if existing:
            return existing

        wallet = self.get_or_create_wallet(db, appointment.patient_id)
        balance = wallet.balance_cents or 0
        if balance < amount_cents:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "message": "No tienes créditos suficientes para agendar esta cita",
                    "required_cents": amount_cents,
                    "balance_cents": balance,
                    "missing_cents": amount_cents - balance,
                },
            )

        platform_fee = self.platform_fee_cents(amount_cents)
        doctor_amount = amount_cents - platform_fee

        self._apply(
            db,
            wallet,
            amount_cents=-amount_cents,
            tx_type=WalletTransactionType.consultation_payment,
            description=f"Pago de la cita #{appointment.id}",
            reference_type="appointment",
            reference_id=appointment.id,
        )
        payment = AppointmentPayment(
            appointment_id=appointment.id,
            patient_id=appointment.patient_id,
            doctor_id=appointment.doctor_id,
            amount_cents=amount_cents,
            doctor_amount_cents=doctor_amount,
            platform_fee_cents=platform_fee,
            status=AppointmentPaymentStatus.held,
        )
        db.add(payment)
        db.flush()
        logger.info(f"Appointment charged: appointment_id={appointment.id}, amount_cents={amount_cents}")
        return payment

    def compute_billable_amount_cents(
        self,
        *,
        billable_seconds: int,
        price_per_min_cents: int,
        max_amount_cents: int,
    ) -> int:
        """Costo real segun el tiempo efectivo, con tope en lo retenido.

        Se redondea hacia arriba al minuto y se aplica un minimo facturable si la
        sesion estuvo activa. Si nunca hubo tiempo, el costo es 0 (se devuelve todo).
        """
        if billable_seconds <= 0:
            return 0
        minutes = max(settings.VIDEO_MIN_BILLABLE_MINUTES, math.ceil(billable_seconds / 60))
        return min(max_amount_cents, minutes * price_per_min_cents)

    def get_held_appointment_payment(self, db: Session, appointment_id: int) -> AppointmentPayment | None:
        return (
            db.query(AppointmentPayment)
            .filter(
                AppointmentPayment.appointment_id == appointment_id,
                AppointmentPayment.status == AppointmentPaymentStatus.held,
            )
            .first()
        )

    def get_appointment_payment(self, db: Session, appointment_id: int) -> AppointmentPayment | None:
        return (
            db.query(AppointmentPayment)
            .filter(AppointmentPayment.appointment_id == appointment_id)
            .first()
        )

    def charge_overtime(self, db: Session, appointment, amount_cents: int) -> bool:
        """Consume creditos del paciente por tiempo extra de la cita.

        Devuelve False si el paciente no tiene saldo suficiente (el llamador debe
        terminar la videollamada). La retencion inicial (``amount_cents`` del pago)
        no se toca: el tiempo extra sale del saldo libre del monedero.
        """
        if amount_cents <= 0:
            return True
        payment = (
            db.query(AppointmentPayment)
            .filter(AppointmentPayment.appointment_id == appointment.id)
            .with_for_update()
            .first()
        )
        if payment is None or payment.status != AppointmentPaymentStatus.held:
            return False

        wallet = self.get_or_create_wallet(db, payment.patient_id)
        if (wallet.balance_cents or 0) < amount_cents:
            return False

        self._apply(
            db,
            wallet,
            amount_cents=-amount_cents,
            tx_type=WalletTransactionType.consultation_payment,
            description=f"Tiempo extra de la cita #{appointment.id}",
            reference_type="appointment",
            reference_id=appointment.id,
        )
        payment.overtime_amount_cents = (payment.overtime_amount_cents or 0) + amount_cents
        db.flush()
        logger.info(
            f"Appointment overtime charged: appointment_id={appointment.id}, amount_cents={amount_cents}"
        )
        return True

    def settle_amounts(
        self,
        *,
        billable_seconds: int,
        price_per_min_cents: int,
        held_amount_cents: int,
        overtime_paid_cents: int,
    ) -> dict:
        """Calcula el costo real y los reembolsos (retencion + tiempo extra)."""
        if billable_seconds <= 0:
            total_cost = 0
        else:
            minutes = max(settings.VIDEO_MIN_BILLABLE_MINUTES, math.ceil(billable_seconds / 60))
            total_cost = min(held_amount_cents + overtime_paid_cents, minutes * price_per_min_cents)

        hold_used = min(held_amount_cents, total_cost)
        overtime_used = max(0, total_cost - held_amount_cents)
        return {
            "total_cost_cents": total_cost,
            "hold_refund_cents": held_amount_cents - hold_used,
            "overtime_refund_cents": overtime_paid_cents - overtime_used,
            "overtime_used_cents": overtime_used,
        }

    def release_appointment(
        self,
        db: Session,
        appointment,
        billable_seconds: int | None = None,
    ) -> AppointmentPayment | None:
        """Liquida la cita cobrando el tiempo real (incluido el tiempo extra).

        La retencion cubre el tiempo reservado; el tiempo extra ya se consumio del
        monedero durante la sesion. Aqui se ajusta lo no usado y se paga al medico.
        """
        payment = (
            db.query(AppointmentPayment)
            .filter(AppointmentPayment.appointment_id == appointment.id)
            .with_for_update()
            .first()
        )
        if payment is None or payment.status != AppointmentPaymentStatus.held:
            return payment
        if appointment.doctor is None:
            return payment

        if billable_seconds is None:
            session = (
                db.query(VideoSession)
                .filter(VideoSession.appointment_id == appointment.id)
                .order_by(VideoSession.id.desc())
                .first()
            )
            billable_seconds = session.billable_seconds if session else None

        if billable_seconds is None:
            # Sin sesion: se libera el total retenido (comportamiento previo).
            actual_amount = payment.amount_cents
            refund_amount = 0
        else:
            amounts = self.settle_amounts(
                billable_seconds=billable_seconds,
                price_per_min_cents=appointment.doctor.price_per_min_cents,
                held_amount_cents=payment.amount_cents,
                overtime_paid_cents=payment.overtime_amount_cents or 0,
            )
            actual_amount = amounts["total_cost_cents"]
            refund_amount = amounts["hold_refund_cents"] + amounts["overtime_refund_cents"]

        if refund_amount > 0:
            patient_wallet = self.get_or_create_wallet(db, payment.patient_id)
            self._apply(
                db,
                patient_wallet,
                amount_cents=refund_amount,
                tx_type=WalletTransactionType.refund,
                description=f"Ajuste por tiempo real de la cita #{appointment.id}",
                reference_type="appointment",
                reference_id=appointment.id,
            )

        platform_fee = self.platform_fee_cents(actual_amount)
        doctor_amount = actual_amount - platform_fee
        if doctor_amount > 0:
            wallet = self.get_or_create_wallet(db, appointment.doctor.user_id)
            self._apply(
                db,
                wallet,
                amount_cents=doctor_amount,
                tx_type=WalletTransactionType.consultation_income,
                description=f"Ingreso por la cita #{appointment.id}",
                reference_type="appointment",
                reference_id=appointment.id,
            )

        payment.billable_seconds = billable_seconds or 0
        payment.billable_amount_cents = actual_amount
        payment.doctor_amount_cents = doctor_amount
        payment.platform_fee_cents = platform_fee
        payment.status = AppointmentPaymentStatus.released
        payment.released_at = datetime.now(UTC)
        db.flush()
        logger.info(
            f"Appointment settled: appointment_id={appointment.id}, "
            f"held={payment.amount_cents}, billed={actual_amount}, refund={refund_amount}"
        )
        return payment

    def refund_appointment(self, db: Session, appointment) -> AppointmentPayment | None:
        payment = (
            db.query(AppointmentPayment)
            .filter(AppointmentPayment.appointment_id == appointment.id)
            .with_for_update()
            .first()
        )
        if payment is None or payment.status != AppointmentPaymentStatus.held:
            return payment

        wallet = self.get_or_create_wallet(db, payment.patient_id)
        refund_amount = payment.amount_cents + (payment.overtime_amount_cents or 0)
        self._apply(
            db,
            wallet,
            amount_cents=refund_amount,
            tx_type=WalletTransactionType.refund,
            description=f"Reembolso de la cita #{appointment.id}",
            reference_type="appointment",
            reference_id=appointment.id,
        )
        payment.status = AppointmentPaymentStatus.refunded
        payment.refunded_at = datetime.now(UTC)
        db.flush()
        logger.info(f"Appointment refunded: appointment_id={appointment.id}")
        return payment

    # --- Consultas ----------------------------------------------------------

    def list_transactions(self, db: Session, user_id: int, limit: int = 20, offset: int = 0):
        query = db.query(WalletTransaction).filter(WalletTransaction.user_id == user_id)
        total = query.count()
        transactions = (
            query.order_by(WalletTransaction.created_at.desc(), WalletTransaction.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return transactions, total

    def build_wallet_response(
        self,
        db: Session,
        user_id: int,
        limit: int = 20,
        doctor_profile_id: int | None = None,
    ) -> dict:
        wallet = self.get_or_create_wallet(db, user_id)
        transactions, _total = self.list_transactions(db, user_id, limit=limit, offset=0)
        income_summary = (
            self.doctor_income_summary(db, doctor_profile_id)
            if doctor_profile_id is not None
            else None
        )
        return {
            "balance_cents": wallet.balance_cents or 0,
            "credits": cents_to_credits(wallet.balance_cents or 0),
            "currency": settings.CREDITS_CURRENCY,
            "min_topup_cents": settings.WALLET_MIN_TOPUP_CENTS,
            "min_withdrawal_cents": settings.WALLET_MIN_WITHDRAWAL_CENTS,
            "platform_fee_bps": settings.PLATFORM_FEE_BPS,
            "platform_fee_percent": self.platform_fee_percent(),
            "income_summary": income_summary,
            "transactions": transactions,
        }


wallet_service = WalletService()
