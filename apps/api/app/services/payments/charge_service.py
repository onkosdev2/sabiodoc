"""Cobros de videoconsultas."""

import json
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.appointment import Appointment, AppointmentStatus
from app.models.consultation import ConsultationStatus
from app.models.payment import (
    ConsultationCharge,
    DoctorEarning,
    DoctorEarningStatus,
    ConsultationChargeStatus,
    PaymentCustomer,
    PaymentMethod,
    PaymentMethodStatus,
    PaymentTransaction,
    PaymentTransactionStatus,
    PaymentTransactionType,
)
from app.models.video_session import PaymentStatus, VideoSession, VideoSessionStatus
from app.services.notification_service import notification_service
from app.services.payments.factory import get_payment_provider

logger = get_logger(__name__)


class ChargeError(Exception):
    def __init__(self, message: str, code: str = "payment_error"):
        super().__init__(message)
        self.code = code
        self.message = message


class ChargeService:
    def _get_method(self, db: Session, charge: ConsultationCharge, patient_id: int) -> PaymentMethod:
        method = None
        if charge.payment_method_id:
            method = (
                db.query(PaymentMethod)
                .filter(
                    PaymentMethod.id == charge.payment_method_id,
                    PaymentMethod.user_id == patient_id,
                    PaymentMethod.status == PaymentMethodStatus.active,
                )
                .first()
            )
        if method is None:
            method = (
                db.query(PaymentMethod)
                .filter(
                    PaymentMethod.user_id == patient_id,
                    PaymentMethod.status == PaymentMethodStatus.active,
                )
                .order_by(PaymentMethod.is_default.desc(), PaymentMethod.created_at.desc())
                .first()
            )
        if method is None:
            raise ChargeError("No hay un método de pago activo. Agrega una tarjeta para continuar.", "no_payment_method")
        charge.payment_method_id = method.id
        return method

    def _get_customer(self, db: Session, patient_id: int, provider_name: str) -> PaymentCustomer:
        customer = db.query(PaymentCustomer).filter(PaymentCustomer.user_id == patient_id).first()
        if customer is None or customer.provider != provider_name:
            raise ChargeError("El paciente no tiene un cliente de pago válido.", "no_customer")
        return customer

    def _succeeded_transaction(self, db: Session, appointment_id: int) -> PaymentTransaction | None:
        return (
            db.query(PaymentTransaction)
            .filter(
                PaymentTransaction.appointment_id == appointment_id,
                PaymentTransaction.type == PaymentTransactionType.initial,
                PaymentTransaction.status == PaymentTransactionStatus.succeeded,
            )
            .order_by(PaymentTransaction.id.desc())
            .first()
        )

    def _requires_action_transaction(self, db: Session, appointment_id: int) -> PaymentTransaction | None:
        return (
            db.query(PaymentTransaction)
            .filter(
                PaymentTransaction.appointment_id == appointment_id,
                PaymentTransaction.type == PaymentTransactionType.initial,
                PaymentTransaction.status == PaymentTransactionStatus.requires_action,
            )
            .order_by(PaymentTransaction.id.desc())
            .first()
        )

    def _apply_success(
        self,
        db: Session,
        *,
        video_session: VideoSession,
        charge: ConsultationCharge,
        transaction: PaymentTransaction,
        reference: str,
    ) -> None:
        transaction.status = PaymentTransactionStatus.succeeded
        transaction.provider_reference = reference
        charge.status = ConsultationChargeStatus.paid
        charge.paid_minutes = charge.quoted_minutes
        charge.paid_amount_cents = charge.quoted_amount_cents
        charge.initial_transaction_id = transaction.id
        video_session.payment_status = PaymentStatus.captured
        video_session.payment_reference = reference
        video_session.payment_amount_cents = charge.quoted_amount_cents
        db.commit()

    def start_initial_charge(self, db: Session, video_session: VideoSession) -> dict:
        appointment = video_session.appointment
        if appointment is None:
            raise ChargeError("La cita no tiene un cobro asociado.", "no_appointment")
        if appointment.confirmation_status != "confirmed":
            raise ChargeError("La cita debe estar confirmada por el médico.", "not_confirmed")

        db.query(Appointment).filter(Appointment.id == appointment.id).with_for_update().first()
        db.refresh(appointment)

        existing = self._succeeded_transaction(db, appointment.id)
        if existing:
            video_session.payment_status = PaymentStatus.captured
            video_session.payment_reference = existing.provider_reference
            db.commit()
            return {"state": "paid", "transaction_id": existing.id}

        pending_action = self._requires_action_transaction(db, appointment.id)
        if pending_action:
            return {"state": "requires_action", "transaction_id": pending_action.id}

        charge = (
            db.query(ConsultationCharge)
            .filter(ConsultationCharge.appointment_id == appointment.id)
            .first()
        )
        if charge is None:
            raise ChargeError("No existe un cargo asociado a la cita.", "no_charge")
        if charge.status == ConsultationChargeStatus.paid:
            video_session.payment_status = PaymentStatus.captured
            db.commit()
            return {"state": "paid", "transaction_id": charge.initial_transaction_id}

        method = self._get_method(db, charge, appointment.patient_id)
        provider = get_payment_provider()
        customer = self._get_customer(db, appointment.patient_id, provider.name)
        attempt = (
            db.query(PaymentTransaction)
            .filter(
                PaymentTransaction.appointment_id == appointment.id,
                PaymentTransaction.type == PaymentTransactionType.initial,
            )
            .count()
            + 1
        )
        idempotency_key = f"appointment-{appointment.id}-initial-{method.id}-{attempt}"

        transaction = PaymentTransaction(
            user_id=appointment.patient_id,
            appointment_id=appointment.id,
            video_session_id=video_session.id,
            type=PaymentTransactionType.initial,
            status=PaymentTransactionStatus.processing,
            amount_cents=charge.quoted_amount_cents,
            currency=settings.PAYMENT_CURRENCY,
            provider=provider.name,
            idempotency_key=idempotency_key,
            metadata_json='{"kind":"initial"}',
        )
        db.add(transaction)
        db.commit()
        db.refresh(transaction)

        try:
            result = provider.create_payment(
                customer_id=customer.provider_customer_id,
                provider_method_id=method.provider_method_id,
                amount_cents=charge.quoted_amount_cents,
                currency=settings.PAYMENT_CURRENCY,
                idempotency_key=idempotency_key,
                metadata={"appointment_id": appointment.id, "video_session_id": video_session.id},
            )
        except Exception as error:
            transaction.status = PaymentTransactionStatus.failed
            transaction.failure_code = "provider_error"
            transaction.failure_message = str(error)
            charge.status = ConsultationChargeStatus.failed
            video_session.payment_status = PaymentStatus.failed
            db.commit()
            raise ChargeError("No se pudo procesar el pago inicial.", "provider_error") from error

        if result.status == "succeeded":
            self._apply_success(
                db,
                video_session=video_session,
                charge=charge,
                transaction=transaction,
                reference=result.reference,
            )
            return {"state": "paid", "transaction_id": transaction.id}

        if result.status == "requires_action":
            transaction.status = PaymentTransactionStatus.requires_action
            transaction.provider_reference = result.reference
            video_session.payment_status = PaymentStatus.authorized
            video_session.payment_reference = result.reference
            db.commit()
            return {
                "state": "requires_action",
                "transaction_id": transaction.id,
                "next_action": result.next_action,
            }

        transaction.status = PaymentTransactionStatus.failed
        transaction.provider_reference = result.reference
        transaction.failure_code = result.failure_code
        transaction.failure_message = result.failure_message
        charge.status = ConsultationChargeStatus.failed
        video_session.payment_status = PaymentStatus.failed
        video_session.payment_reference = result.reference
        db.commit()
        raise ChargeError(result.failure_message or "El pago fue rechazado.", result.failure_code or "payment_failed")

    def _apply_extension_success(
        self,
        db: Session,
        *,
        video_session: VideoSession,
        charge: ConsultationCharge,
        transaction: PaymentTransaction,
        reference: str,
        minutes: int,
        amount_cents: int,
        platform_fee_cents: int,
        doctor_net_cents: int,
    ) -> None:
        now = datetime.now(UTC)
        transaction.status = PaymentTransactionStatus.succeeded
        transaction.provider_reference = reference
        charge.paid_minutes = (charge.paid_minutes or 0) + minutes
        charge.paid_amount_cents = (charge.paid_amount_cents or 0) + amount_cents
        charge.platform_fee_cents = (charge.platform_fee_cents or 0) + platform_fee_cents
        charge.doctor_net_cents = (charge.doctor_net_cents or 0) + doctor_net_cents
        charge.last_extension_transaction_id = transaction.id
        video_session.estimated_minutes = (video_session.estimated_minutes or 0) + minutes
        video_session.payment_amount_cents = (video_session.payment_amount_cents or 0) + amount_cents
        video_session.extension_deadline = None
        video_session.extension_requested_minutes = None
        video_session.extension_requested_amount_cents = None
        video_session.extension_requested_at = None
        video_session.extension_request_expires_at = None
        video_session.status = VideoSessionStatus.active
        # Solo se reanuda el tiempo si ambos siguen dentro de Jitsi. Si alguno
        # salió, la sesión queda activa pero pausada hasta que el médico reanude.
        if video_session.started_at is None and video_session_service_both_in_jitsi(video_session):
            video_session.started_at = now
        minimum_expiry = now + timedelta(minutes=video_session.estimated_minutes + 60)
        if video_session.expires_at < minimum_expiry:
            video_session.expires_at = minimum_expiry
        db.commit()

    def _clear_extension_request(self, video_session: VideoSession) -> None:
        video_session.extension_requested_minutes = None
        video_session.extension_requested_amount_cents = None
        video_session.extension_requested_at = None
        video_session.extension_request_expires_at = None

    def _restore_after_extension_request(
        self, db: Session, video_session: VideoSession, now: datetime
    ) -> None:
        self._clear_extension_request(video_session)
        target = (video_session.estimated_minutes or 0) * 60
        video_session.started_at = None
        if (video_session.billable_seconds or 0) >= target:
            video_session.status = VideoSessionStatus.extension_pending
            video_session.extension_deadline = now + timedelta(seconds=60)
        else:
            video_session.status = VideoSessionStatus.active
            video_session.extension_deadline = None
        db.commit()

    def request_extension(self, db: Session, video_session: VideoSession, minutes: int) -> dict:
        """Registra una ampliación pendiente. No cobra hasta que el paciente confirme."""
        if minutes not in (5, 10, 15):
            raise ChargeError("La ampliación debe ser de 5, 10 o 15 minutos.", "invalid_minutes")
        appointment = video_session.appointment
        if appointment is None:
            raise ChargeError("La cita no tiene un cobro asociado.", "no_appointment")
        if video_session.payment_status != PaymentStatus.captured:
            raise ChargeError("El pago inicial aún no está confirmado.", "not_paid")
        if video_session.status not in {VideoSessionStatus.active, VideoSessionStatus.extension_pending}:
            raise ChargeError("La sesión no está activa.", "not_active")
        if video_session.extension_requested_at is not None:
            raise ChargeError("Ya hay una ampliación esperando confirmación.", "extension_already_requested")

        db.query(Appointment).filter(Appointment.id == appointment.id).with_for_update().first()
        db.refresh(video_session)

        pending = (
            db.query(PaymentTransaction)
            .filter(
                PaymentTransaction.appointment_id == appointment.id,
                PaymentTransaction.type == PaymentTransactionType.extension,
                PaymentTransaction.status.in_(
                    [PaymentTransactionStatus.processing, PaymentTransactionStatus.requires_action]
                ),
            )
            .first()
        )
        if pending is not None:
            raise ChargeError(
                "Ya existe un cobro de ampliación en proceso.", "extension_payment_pending"
            )

        price = video_session.doctor_price_per_min_cents or 0
        if price <= 0:
            raise ChargeError("La tarifa de la consulta no es válida.", "invalid_price")
        amount_cents = minutes * price
        now = datetime.now(UTC)

        # La solicitud pausa el cronómetro: el tiempo extra no corre hasta que
        # el paciente autorice el cobro.
        from app.services.video_session_service import video_session_service

        video_session_service.reconcile_timer(video_session, now)
        video_session_service.pause_timer(video_session, now)
        video_session.extension_requested_minutes = minutes
        video_session.extension_requested_amount_cents = amount_cents
        video_session.extension_requested_at = now
        video_session.extension_request_expires_at = now + timedelta(seconds=120)
        video_session.extension_deadline = None
        video_session.status = VideoSessionStatus.extension_requested
        db.commit()
        logger.info(
            f"Extension requested: session={video_session.id}, minutes={minutes}, amount={amount_cents}"
        )
        return {
            "state": "requested",
            "minutes": minutes,
            "amount_cents": amount_cents,
            "expires_at": video_session.extension_request_expires_at,
        }

    def confirm_extension(self, db: Session, video_session: VideoSession) -> dict:
        """Cobra la ampliación previamente solicitada, tras confirmación del paciente."""
        appointment = video_session.appointment
        if appointment is None:
            raise ChargeError("La cita no tiene un cobro asociado.", "no_appointment")
        if video_session.status != VideoSessionStatus.extension_requested:
            raise ChargeError("No hay una ampliación pendiente de confirmación.", "no_extension_request")
        minutes = video_session.extension_requested_minutes
        amount_cents = video_session.extension_requested_amount_cents
        if not minutes or amount_cents is None:
            raise ChargeError("La solicitud de ampliación no es válida.", "invalid_extension_request")

        now = datetime.now(UTC)
        if (
            video_session.extension_request_expires_at is not None
            and video_session.extension_request_expires_at <= now
        ):
            self._restore_after_extension_request(db, video_session, now)
            raise ChargeError("La solicitud de ampliación expiró.", "extension_request_expired")
        if not video_session_service_both_in_jitsi(video_session):
            raise ChargeError(
                "El paciente y el médico deben estar en la videollamada para ampliar la consulta.",
                "not_present",
            )

        db.query(Appointment).filter(Appointment.id == appointment.id).with_for_update().first()
        db.refresh(video_session)

        pending_action = (
            db.query(PaymentTransaction)
            .filter(
                PaymentTransaction.appointment_id == appointment.id,
                PaymentTransaction.type == PaymentTransactionType.extension,
                PaymentTransaction.status == PaymentTransactionStatus.requires_action,
            )
            .order_by(PaymentTransaction.id.desc())
            .first()
        )
        if pending_action is not None:
            return {
                "state": "requires_action",
                "transaction_id": pending_action.id,
                "next_action": (
                    "mock_3ds" if pending_action.provider == "mock" else "provider_action"
                ),
            }

        charge = (
            db.query(ConsultationCharge)
            .filter(ConsultationCharge.appointment_id == appointment.id)
            .first()
        )
        if charge is None:
            raise ChargeError("No existe un cargo asociado a la cita.", "no_charge")
        method = self._get_method(db, charge, appointment.patient_id)
        provider = get_payment_provider()
        customer = self._get_customer(db, appointment.patient_id, provider.name)

        platform_fee_cents = int(round(amount_cents * settings.PLATFORM_FEE_BPS / 10_000))
        doctor_net_cents = amount_cents - platform_fee_cents
        attempt = (
            db.query(PaymentTransaction)
            .filter(
                PaymentTransaction.appointment_id == appointment.id,
                PaymentTransaction.type == PaymentTransactionType.extension,
            )
            .count()
            + 1
        )
        idempotency_key = f"appointment-{appointment.id}-extension-{attempt}"

        transaction = PaymentTransaction(
            user_id=appointment.patient_id,
            appointment_id=appointment.id,
            video_session_id=video_session.id,
            type=PaymentTransactionType.extension,
            status=PaymentTransactionStatus.processing,
            amount_cents=amount_cents,
            currency=settings.PAYMENT_CURRENCY,
            provider=provider.name,
            idempotency_key=idempotency_key,
            metadata_json=json.dumps(
                {
                    "kind": "extension",
                    "minutes": minutes,
                    "patient_confirmed_at": now.isoformat(),
                }
            ),
        )
        db.add(transaction)
        db.commit()
        db.refresh(transaction)

        try:
            result = provider.create_payment(
                customer_id=customer.provider_customer_id,
                provider_method_id=method.provider_method_id,
                amount_cents=amount_cents,
                currency=settings.PAYMENT_CURRENCY,
                idempotency_key=idempotency_key,
                metadata={
                    "appointment_id": appointment.id,
                    "video_session_id": video_session.id,
                    "minutes": minutes,
                },
            )
        except Exception as error:
            transaction.status = PaymentTransactionStatus.failed
            transaction.failure_code = "provider_error"
            transaction.failure_message = str(error)
            video_session.extension_request_expires_at = now + timedelta(seconds=60)
            db.commit()
            raise ChargeError("No se pudo procesar la ampliación.", "provider_error") from error

        if result.status == "succeeded":
            self._apply_extension_success(
                db,
                video_session=video_session,
                charge=charge,
                transaction=transaction,
                reference=result.reference,
                minutes=minutes,
                amount_cents=amount_cents,
                platform_fee_cents=platform_fee_cents,
                doctor_net_cents=doctor_net_cents,
            )
            return {"state": "paid", "transaction_id": transaction.id, "minutes": minutes}

        if result.status == "requires_action":
            transaction.status = PaymentTransactionStatus.requires_action
            transaction.provider_reference = result.reference
            video_session.extension_request_expires_at = now + timedelta(minutes=5)
            db.commit()
            return {
                "state": "requires_action",
                "transaction_id": transaction.id,
                "next_action": result.next_action,
            }

        transaction.status = PaymentTransactionStatus.failed
        transaction.provider_reference = result.reference
        transaction.failure_code = result.failure_code
        transaction.failure_message = result.failure_message
        video_session.extension_request_expires_at = now + timedelta(seconds=60)
        db.commit()
        raise ChargeError(result.failure_message or "La ampliación fue rechazada.", result.failure_code or "payment_failed")

    def reject_extension(self, db: Session, video_session: VideoSession) -> None:
        if video_session.status != VideoSessionStatus.extension_requested:
            raise ChargeError("No hay una ampliación pendiente.", "no_extension_request")
        now = datetime.now(UTC)
        db.query(PaymentTransaction).filter(
            PaymentTransaction.video_session_id == video_session.id,
            PaymentTransaction.type == PaymentTransactionType.extension,
            PaymentTransaction.status.in_(
                [PaymentTransactionStatus.processing, PaymentTransactionStatus.requires_action]
            ),
        ).update(
            {PaymentTransaction.status: PaymentTransactionStatus.cancelled},
            synchronize_session=False,
        )
        self._restore_after_extension_request(db, video_session, now)

    def expire_extension_request(
        self, db: Session, video_session: VideoSession, now: datetime | None = None
    ) -> bool:
        if video_session.status != VideoSessionStatus.extension_requested:
            return False
        now = now or datetime.now(UTC)
        if (
            video_session.extension_request_expires_at is not None
            and video_session.extension_request_expires_at > now
        ):
            return False
        pending_action = (
            db.query(PaymentTransaction)
            .filter(
                PaymentTransaction.video_session_id == video_session.id,
                PaymentTransaction.type == PaymentTransactionType.extension,
                PaymentTransaction.status == PaymentTransactionStatus.requires_action,
            )
            .first()
        )
        if pending_action is not None:
            return False
        self._restore_after_extension_request(db, video_session, now)
        return True

    def confirm_pending_payment(self, db: Session, video_session: VideoSession) -> dict:
        appointment = video_session.appointment
        if appointment is None:
            raise ChargeError("No existe una cita asociada.", "no_appointment")
        transaction = (
            db.query(PaymentTransaction)
            .filter(
                PaymentTransaction.appointment_id == appointment.id,
                PaymentTransaction.status == PaymentTransactionStatus.requires_action,
            )
            .order_by(PaymentTransaction.id.desc())
            .first()
        )
        if transaction is None:
            if self._succeeded_transaction(db, appointment.id):
                return {"state": "paid"}
            raise ChargeError("No hay un pago pendiente de confirmación.", "no_pending_payment")
        provider = get_payment_provider()
        result = provider.confirm_payment(reference=transaction.provider_reference or "")
        if result.status != "succeeded":
            transaction.status = PaymentTransactionStatus.failed
            transaction.failure_code = result.failure_code
            transaction.failure_message = result.failure_message
            db.commit()
            raise ChargeError(result.failure_message or "No se pudo confirmar el pago.", "payment_failed")

        charge = (
            db.query(ConsultationCharge)
            .filter(ConsultationCharge.appointment_id == appointment.id)
            .first()
        )
        if charge is None:
            raise ChargeError("No existe un cargo asociado a la cita.", "no_charge")
        if transaction.type == PaymentTransactionType.extension:
            metadata = json.loads(transaction.metadata_json or "{}")
            minutes = int(metadata.get("minutes", 0))
            amount_cents = transaction.amount_cents
            platform_fee_cents = int(round(amount_cents * settings.PLATFORM_FEE_BPS / 10_000))
            self._apply_extension_success(
                db,
                video_session=video_session,
                charge=charge,
                transaction=transaction,
                reference=result.reference,
                minutes=minutes,
                amount_cents=amount_cents,
                platform_fee_cents=platform_fee_cents,
                doctor_net_cents=amount_cents - platform_fee_cents,
            )
            return {"state": "paid", "transaction_id": transaction.id, "minutes": minutes}

        self._apply_success(
            db,
            video_session=video_session,
            charge=charge,
            transaction=transaction,
            reference=result.reference,
        )
        return {"state": "paid", "transaction_id": transaction.id}

    def check_time_exhausted(self, db: Session, video_session: VideoSession) -> None:
        appointment = video_session.appointment
        if appointment is None:
            return
        now = datetime.now(UTC)
        if video_session.status == VideoSessionStatus.extension_requested:
            self.expire_extension_request(db, video_session, now)
            return
        if video_session.status == VideoSessionStatus.active and video_session.started_at is not None:
            target = (video_session.estimated_minutes or 0) * 60
            elapsed = (video_session.billable_seconds or 0) + int((now - video_session.started_at).total_seconds())
            if target > 0 and elapsed >= target:
                segment = max(0, target - (video_session.billable_seconds or 0))
                video_session.billable_seconds = (video_session.billable_seconds or 0) + segment
                video_session.started_at = None
                video_session.status = VideoSessionStatus.extension_pending
                video_session.extension_deadline = now + timedelta(seconds=60)
                db.commit()
            return
        if (
            video_session.status == VideoSessionStatus.extension_pending
            and video_session.extension_deadline is not None
            and video_session.extension_deadline <= now
        ):
            self.finalize_session(db, video_session, reason="extension_timeout")

    def finalize_session(self, db: Session, video_session: VideoSession, reason: str) -> None:
        now = datetime.now(UTC)
        self._clear_extension_request(video_session)
        db.query(PaymentTransaction).filter(
            PaymentTransaction.video_session_id == video_session.id,
            PaymentTransaction.type == PaymentTransactionType.extension,
            PaymentTransaction.status.in_(
                [PaymentTransactionStatus.processing, PaymentTransactionStatus.requires_action]
            ),
        ).update(
            {PaymentTransaction.status: PaymentTransactionStatus.cancelled},
            synchronize_session=False,
        )
        if video_session.started_at is not None:
            segment = max(0, int((now - video_session.started_at).total_seconds()))
            video_session.billable_seconds = (video_session.billable_seconds or 0) + segment
            video_session.started_at = None
        video_session.status = VideoSessionStatus.completed
        video_session.ended_at = video_session.ended_at or now
        video_session.closed_reason = reason
        video_session.patient_present = False
        video_session.doctor_present = False
        appointment = video_session.appointment
        if appointment is not None:
            appointment.status = AppointmentStatus.completed
            appointment.completed_at = appointment.completed_at or now
            if appointment.consultation:
                appointment.consultation.status = ConsultationStatus.closed
                appointment.consultation.closed_at = appointment.consultation.closed_at or now
            charge = (
                db.query(ConsultationCharge)
                .filter(ConsultationCharge.appointment_id == appointment.id)
                .first()
            )
            if charge is not None:
                earning = (
                    db.query(DoctorEarning)
                    .filter(DoctorEarning.appointment_id == appointment.id)
                    .first()
                )
                if earning is None:
                    earning = DoctorEarning(
                        doctor_id=appointment.doctor_id,
                        appointment_id=appointment.id,
                        gross_cents=charge.paid_amount_cents or 0,
                        platform_fee_cents=charge.platform_fee_cents or 0,
                        net_cents=charge.doctor_net_cents or 0,
                        status=DoctorEarningStatus.available,
                        available_at=now,
                    )
                    db.add(earning)
                else:
                    earning.gross_cents = charge.paid_amount_cents or 0
                    earning.platform_fee_cents = charge.platform_fee_cents or 0
                    earning.net_cents = charge.doctor_net_cents or 0
            notification_service.create(
                db,
                user_id=appointment.patient_id,
                notification_type="video_consultation_completed",
                title="Videoconsulta finalizada",
                body="La videoconsulta finalizó. Puedes revisar el detalle en tus citas.",
                action_url="/me/appointments",
                metadata={"appointment_id": appointment.id, "action_label": "Ver cita"},
            )
        db.commit()

    def confirm_initial_charge(self, db: Session, video_session: VideoSession) -> dict:
        return self.confirm_pending_payment(db, video_session)

    def _start_timer(self, db: Session, video_session: VideoSession) -> bool:
        if video_session.payment_status != PaymentStatus.captured:
            return False
        if video_session.started_at is not None:
            return False
        if not video_session_service_both_in_jitsi(video_session):
            return False
        now = datetime.now(UTC)
        video_session.started_at = now
        video_session.status = VideoSessionStatus.active
        video_session.extension_deadline = None
        minimum_expiry = now + timedelta(minutes=video_session.estimated_minutes + 60)
        if video_session.expires_at < minimum_expiry:
            video_session.expires_at = minimum_expiry
        db.commit()
        return True

    def maybe_start_timer(self, db: Session, video_session: VideoSession) -> bool:
        """Inicia solo una sesión preparada cuando el cobro ya está confirmado."""
        if video_session.appointment is None:
            return False
        if video_session.status != VideoSessionStatus.prepared:
            return False
        return self._start_timer(db, video_session)

    def resume_timer(self, db: Session, video_session: VideoSession) -> bool:
        """Reanuda una sesión pausada sin cobrar de nuevo.

        No aplica a `extension_pending`: en ese estado el médico debe solicitar
        minutos adicionales antes de que el cronómetro vuelva a correr.
        """
        if video_session.appointment is None:
            return False
        if video_session.status not in {VideoSessionStatus.prepared, VideoSessionStatus.active}:
            return False
        return self._start_timer(db, video_session)


def video_session_service_both_in_jitsi(video_session: VideoSession) -> bool:
    now = datetime.now(UTC)
    timeout = settings.JITSI_PRESENCE_TIMEOUT_SECONDS

    def fresh(last_seen) -> bool:
        if last_seen is None:
            return True
        return (now - last_seen).total_seconds() <= timeout

    return (
        bool(video_session.jitsi_patient_present)
        and bool(video_session.jitsi_doctor_present)
        and fresh(video_session.jitsi_patient_last_seen_at)
        and fresh(video_session.jitsi_doctor_last_seen_at)
    )


charge_service = ChargeService()
