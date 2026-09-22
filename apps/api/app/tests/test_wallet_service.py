"""Monedero de créditos: recargas, pagos de cita, reembolsos y retiros."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException

from app.db.session import SessionLocal
from app.models.appointment import Appointment
from app.models.doctor_profile import DoctorProfile
from app.models.notification import Notification
from app.models.specialty import Specialty
from app.models.user import User, UserRole
from app.models.video_session import (
    PaymentStatus,
    VideoProvider,
    VideoSession,
    VideoSessionStatus,
)
from app.models.video_session_event import VideoSessionEvent
from app.models.wallet import AppointmentPayment, AppointmentPaymentStatus, Wallet, WalletTransaction, Withdrawal
from app.services.video_session_service import video_session_service
from app.services.wallet_service import wallet_service


def _make_user(db, role: UserRole = UserRole.patient) -> User:
    user = User(
        email=f"wallet_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="x",
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _cleanup(db, *, user_ids: list[int], appointment_ids: list[int]) -> None:
    if appointment_ids:
        session_ids = [
            row[0]
            for row in db.query(VideoSession.id).filter(
                VideoSession.appointment_id.in_(appointment_ids)
            )
        ]
        if session_ids:
            db.query(VideoSessionEvent).filter(
                VideoSessionEvent.video_session_id.in_(session_ids)
            ).delete(synchronize_session=False)
            db.query(VideoSession).filter(VideoSession.id.in_(session_ids)).delete(
                synchronize_session=False
            )
        db.query(AppointmentPayment).filter(
            AppointmentPayment.appointment_id.in_(appointment_ids)
        ).delete(synchronize_session=False)
        db.query(Appointment).filter(Appointment.id.in_(appointment_ids)).delete(
            synchronize_session=False
        )
    if user_ids:
        db.query(Notification).filter(Notification.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(WalletTransaction).filter(WalletTransaction.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(Withdrawal).filter(Withdrawal.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(Wallet).filter(Wallet.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(DoctorProfile).filter(DoctorProfile.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
    db.commit()


def _make_appointment(db, patient: User, doctor_user: User, duration: int = 30) -> Appointment:
    profile = DoctorProfile(
        user_id=doctor_user.id,
        display_name="Dr. Wallet Test",
        price_per_min_cents=500,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    specialty = db.query(Specialty).first()
    assert specialty is not None
    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=profile.id,
        specialty_id=specialty.id,
        scheduled_at=datetime.now(UTC) + timedelta(days=1),
        duration_minutes=duration,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def test_topup_updates_balance():
    db = SessionLocal()
    user_id = None
    try:
        user = _make_user(db)
        user_id = user.id
        wallet_service.topup(db, user.id, 5000)
        db.commit()
        assert wallet_service.get_balance_cents(db, user.id) == 5000
    finally:
        _cleanup(db, user_ids=[user_id] if user_id else [], appointment_ids=[])
        db.close()


def test_topup_below_minimum_is_rejected():
    db = SessionLocal()
    user_id = None
    try:
        user = _make_user(db)
        user_id = user.id
        with pytest.raises(HTTPException) as exc:
            wallet_service.topup(db, user.id, 100)
        assert exc.value.status_code == 400
        db.rollback()
    finally:
        _cleanup(db, user_ids=[user_id] if user_id else [], appointment_ids=[])
        db.close()


def test_charge_appointment_holds_patient_credits():
    db = SessionLocal()
    user_ids: list[int] = []
    appointment_ids: list[int] = []
    try:
        patient = _make_user(db)
        doctor_user = _make_user(db, UserRole.doctor)
        user_ids = [patient.id, doctor_user.id]
        appointment = _make_appointment(db, patient, doctor_user)
        appointment_ids = [appointment.id]

        wallet_service.topup(db, patient.id, 20000)
        db.commit()

        amount = wallet_service.appointment_amount_cents(appointment)
        assert amount == 15000  # 30 min * 500 centavos
        payment = wallet_service.charge_appointment(db, appointment, amount)
        db.commit()

        assert payment.status == AppointmentPaymentStatus.held
        assert wallet_service.get_balance_cents(db, patient.id) == 5000
        assert wallet_service.get_balance_cents(db, doctor_user.id) == 0
    finally:
        _cleanup(db, user_ids=user_ids, appointment_ids=appointment_ids)
        db.close()


def test_charge_appointment_without_credits_is_rejected():
    db = SessionLocal()
    user_ids: list[int] = []
    appointment_ids: list[int] = []
    try:
        patient = _make_user(db)
        doctor_user = _make_user(db, UserRole.doctor)
        user_ids = [patient.id, doctor_user.id]
        appointment = _make_appointment(db, patient, doctor_user)
        appointment_ids = [appointment.id]

        wallet_service.topup(db, patient.id, 1000)
        db.commit()

        with pytest.raises(HTTPException) as exc:
            wallet_service.charge_appointment(db, appointment, 15000)
        assert exc.value.status_code == 402
        db.rollback()
    finally:
        _cleanup(db, user_ids=user_ids, appointment_ids=appointment_ids)
        db.close()


def test_release_appointment_pays_doctor():
    db = SessionLocal()
    user_ids: list[int] = []
    appointment_ids: list[int] = []
    try:
        patient = _make_user(db)
        doctor_user = _make_user(db, UserRole.doctor)
        user_ids = [patient.id, doctor_user.id]
        appointment = _make_appointment(db, patient, doctor_user)
        appointment_ids = [appointment.id]

        wallet_service.topup(db, patient.id, 20000)
        amount = wallet_service.appointment_amount_cents(appointment)
        wallet_service.charge_appointment(db, appointment, amount)
        db.commit()

        wallet_service.release_appointment(db, appointment)
        db.commit()

        assert wallet_service.get_balance_cents(db, doctor_user.id) == amount
        db.refresh(appointment)
        assert appointment.payment.status == AppointmentPaymentStatus.released
    finally:
        _cleanup(db, user_ids=user_ids, appointment_ids=appointment_ids)
        db.close()


def test_refund_appointment_returns_credits_to_patient():
    db = SessionLocal()
    user_ids: list[int] = []
    appointment_ids: list[int] = []
    try:
        patient = _make_user(db)
        doctor_user = _make_user(db, UserRole.doctor)
        user_ids = [patient.id, doctor_user.id]
        appointment = _make_appointment(db, patient, doctor_user)
        appointment_ids = [appointment.id]

        wallet_service.topup(db, patient.id, 20000)
        amount = wallet_service.appointment_amount_cents(appointment)
        wallet_service.charge_appointment(db, appointment, amount)
        db.commit()

        wallet_service.refund_appointment(db, appointment)
        db.commit()

        assert wallet_service.get_balance_cents(db, patient.id) == 20000
        assert wallet_service.get_balance_cents(db, doctor_user.id) == 0
        db.refresh(appointment)
        assert appointment.payment.status == AppointmentPaymentStatus.refunded
    finally:
        _cleanup(db, user_ids=user_ids, appointment_ids=appointment_ids)
        db.close()


def test_withdrawal_rejection_refunds_credits():
    db = SessionLocal()
    user_id = None
    try:
        user = _make_user(db)
        user_id = user.id
        wallet_service.topup(db, user.id, 5000)
        db.commit()

        withdrawal = wallet_service.request_withdrawal(db, user.id, 2000, "Cuenta demo")
        db.commit()
        assert wallet_service.get_balance_cents(db, user.id) == 3000

        wallet_service.process_withdrawal(
            db, withdrawal, approve=False, admin_user_id=user.id, notes="rechazado"
        )
        db.commit()
        assert wallet_service.get_balance_cents(db, user.id) == 5000
    finally:
        _cleanup(db, user_ids=[user_id] if user_id else [], appointment_ids=[])
        db.close()


def test_withdrawal_approval_keeps_debit():
    db = SessionLocal()
    user_id = None
    try:
        user = _make_user(db)
        user_id = user.id
        wallet_service.topup(db, user.id, 5000)
        db.commit()

        withdrawal = wallet_service.request_withdrawal(db, user.id, 2000, "Cuenta demo")
        db.commit()

        wallet_service.process_withdrawal(
            db, withdrawal, approve=True, admin_user_id=user.id, notes=None
        )
        db.commit()
        assert wallet_service.get_balance_cents(db, user.id) == 3000
    finally:
        _cleanup(db, user_ids=[user_id] if user_id else [], appointment_ids=[])
        db.close()


def test_compute_billable_amount_rounds_up_and_caps():
    # 61 s => 2 min; 2 * 500 = 1000, pero el tope es 900.
    amount = wallet_service.compute_billable_amount_cents(
        billable_seconds=61, price_per_min_cents=500, max_amount_cents=900
    )
    assert amount == 900
    # Sin tiempo no se cobra.
    assert (
        wallet_service.compute_billable_amount_cents(
            billable_seconds=0, price_per_min_cents=500, max_amount_cents=900
        )
        == 0
    )
    # Minimo facturable de 1 minuto aunque hayan pasado 5 s.
    assert (
        wallet_service.compute_billable_amount_cents(
            billable_seconds=5, price_per_min_cents=500, max_amount_cents=900
        )
        == 500
    )


def test_release_appointment_bills_real_time_and_refunds_remainder():
    db = SessionLocal()
    user_ids: list[int] = []
    appointment_ids: list[int] = []
    try:
        patient = _make_user(db)
        doctor_user = _make_user(db, UserRole.doctor)
        user_ids = [patient.id, doctor_user.id]
        appointment = _make_appointment(db, patient, doctor_user, duration=30)
        appointment_ids = [appointment.id]

        wallet_service.topup(db, patient.id, 20000)
        held = wallet_service.appointment_amount_cents(appointment)  # 15000
        wallet_service.charge_appointment(db, appointment, held)
        db.commit()

        # La sesion duro 5 minutos reales: se cobra 5 * 500 = 2500 y se devuelve el resto.
        payment = wallet_service.release_appointment(db, appointment, billable_seconds=300)
        db.commit()

        assert payment is not None
        assert payment.billable_amount_cents == 2500
        assert wallet_service.get_balance_cents(db, patient.id) == 20000 - 2500
        assert wallet_service.get_balance_cents(db, doctor_user.id) == 2500
    finally:
        _cleanup(db, user_ids=user_ids, appointment_ids=appointment_ids)
        db.close()


def test_reconcile_timer_pauses_and_only_bills_presence_time():
    """El medico no puede hacer correr el reloj si el paciente no esta presente."""
    now = datetime.now(UTC)
    session = VideoSession(
        patient_id=1,
        doctor_id=1,
        provider=VideoProvider.jitsi_mock,
        status=VideoSessionStatus.active,
        payment_status=PaymentStatus.pending,
        provider_room_name="room-reconcile",
        doctor_price_per_min_cents=500,
        estimated_minutes=30,
        prepaid_amount_cents=15000,
        expires_at=now + timedelta(hours=1),
    )
    session.started_at = now - timedelta(seconds=150)
    session.patient_present = True
    session.doctor_present = True
    # El paciente dejo de dar senales hace 60 s (pasado el timeout); el medico sigue conectado.
    session.patient_last_seen_at = now - timedelta(seconds=60)
    session.doctor_last_seen_at = now

    paused = video_session_service.reconcile_timer(session, now)

    assert paused is True
    assert session.started_at is None
    # Solo se factura hasta el ultimo momento con ambos presentes (90 s, no 150 s).
    assert session.billable_seconds == 90


def test_settle_amounts_accounts_for_overtime():
    # Retencion 15000 (30 min), tiempo extra ya consumido 5000; 36 min reales = 18000.
    amounts = wallet_service.settle_amounts(
        billable_seconds=36 * 60,
        price_per_min_cents=500,
        held_amount_cents=15000,
        overtime_paid_cents=5000,
    )
    assert amounts["total_cost_cents"] == 18000
    assert amounts["hold_refund_cents"] == 0
    assert amounts["overtime_refund_cents"] == 2000  # 5000 - 3000 usados


def test_process_overtime_billing_consumes_credits_and_stops_at_zero():
    """El tiempo extra consume creditos y deja de cobrar cuando no alcanza."""
    db = SessionLocal()
    user_ids: list[int] = []
    appointment_ids: list[int] = []
    try:
        patient = _make_user(db)
        doctor_user = _make_user(db, UserRole.doctor)
        user_ids = [patient.id, doctor_user.id]
        appointment = _make_appointment(db, patient, doctor_user, duration=30)
        appointment_ids = [appointment.id]

        wallet_service.topup(db, patient.id, 20000)
        wallet_service.charge_appointment(db, appointment, 15000)
        db.commit()

        now = datetime.now(UTC)
        session = VideoSession(
            appointment_id=appointment.id,
            patient_id=patient.id,
            doctor_id=appointment.doctor_id,
            provider=VideoProvider.jitsi_mock,
            status=VideoSessionStatus.active,
            payment_status=PaymentStatus.authorized,
            provider_room_name=f"room-ot-{uuid.uuid4().hex[:8]}",
            doctor_price_per_min_cents=500,
            estimated_minutes=30,
            prepaid_amount_cents=15000,
            expires_at=now + timedelta(hours=2),
            started_at=now - timedelta(minutes=31),
            patient_present=True,
            doctor_present=True,
            patient_last_seen_at=now,
            doctor_last_seen_at=now,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        # 31 min => 1 min extra => 500; saldo libre 5000 -> 4500.
        assert video_session_service.process_overtime_billing(db, session, now) is True
        db.commit()
        payment = wallet_service.get_appointment_payment(db, appointment.id)
        assert payment.overtime_amount_cents == 500
        assert wallet_service.get_balance_cents(db, patient.id) == 4500

        # 40 min => 10 min extra => 5000 acumulado; el saldo libre llega justo a 0.
        session.started_at = now - timedelta(minutes=40)
        assert video_session_service.process_overtime_billing(db, session, now) is True
        db.commit()
        assert wallet_service.get_balance_cents(db, patient.id) == 0

        # 41 min => necesita 500 mas y no hay saldo: debe devolver False.
        session.started_at = now - timedelta(minutes=41)
        assert video_session_service.process_overtime_billing(db, session, now) is False
        db.commit()
    finally:
        _cleanup(db, user_ids=user_ids, appointment_ids=appointment_ids)
        db.close()


def test_terminate_for_no_credits_closes_session_and_settles():
    db = SessionLocal()
    user_ids: list[int] = []
    appointment_ids: list[int] = []
    try:
        patient = _make_user(db)
        doctor_user = _make_user(db, UserRole.doctor)
        user_ids = [patient.id, doctor_user.id]
        appointment = _make_appointment(db, patient, doctor_user, duration=30)
        appointment_ids = [appointment.id]

        wallet_service.topup(db, patient.id, 15000)
        wallet_service.charge_appointment(db, appointment, 15000)
        db.commit()

        now = datetime.now(UTC)
        session = VideoSession(
            appointment_id=appointment.id,
            patient_id=patient.id,
            doctor_id=appointment.doctor_id,
            provider=VideoProvider.jitsi_mock,
            status=VideoSessionStatus.active,
            payment_status=PaymentStatus.authorized,
            provider_room_name=f"room-noterm-{uuid.uuid4().hex[:8]}",
            doctor_price_per_min_cents=500,
            estimated_minutes=30,
            prepaid_amount_cents=15000,
            expires_at=now + timedelta(hours=2),
            started_at=now - timedelta(minutes=31),
            patient_present=True,
            doctor_present=True,
            patient_last_seen_at=now,
            doctor_last_seen_at=now,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        video_session_service.terminate_for_no_credits(db, session, now)
        db.commit()
        db.refresh(session)
        db.refresh(appointment)

        assert session.status == VideoSessionStatus.completed
        assert session.closed_reason == "completed_no_credits"
        assert session.started_at is None
        assert appointment.status.value == "completed"
        payment = wallet_service.get_appointment_payment(db, appointment.id)
        assert payment.status.value == "released"
    finally:
        _cleanup(db, user_ids=user_ids, appointment_ids=appointment_ids)
        db.close()
