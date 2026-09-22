"""Cierre automático de videoconsultas abandonadas."""

import uuid
from datetime import UTC, datetime, timedelta

from app.db.session import SessionLocal
from app.models.appointment import Appointment, AppointmentStatus
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
from app.models.wallet import (
    AppointmentPayment,
    AppointmentPaymentStatus,
    Wallet,
    WalletTransaction,
)
from app.services.video_session_service import video_session_service
from app.services.wallet_service import wallet_service


def _make_user(db, role: UserRole = UserRole.patient) -> User:
    user = User(email=f"autoclose_{uuid.uuid4().hex[:8]}@example.com", password_hash="x", role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_appointment(db, patient: User, doctor_user: User) -> Appointment:
    profile = DoctorProfile(user_id=doctor_user.id, display_name="Dr. Autoclose", price_per_min_cents=500)
    db.add(profile)
    db.commit()
    db.refresh(profile)

    specialty = db.query(Specialty).first()
    assert specialty is not None
    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=profile.id,
        specialty_id=specialty.id,
        scheduled_at=datetime.now(UTC) - timedelta(minutes=5),
        duration_minutes=30,
        status=AppointmentStatus.scheduled,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def _make_session(db, appointment: Appointment, *, stale: bool, billable_seconds: int = 0) -> VideoSession:
    now = datetime.now(UTC)
    last_seen = now - timedelta(minutes=30) if stale else now
    session = VideoSession(
        appointment_id=appointment.id,
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id,
        provider=VideoProvider.jitsi,
        status=VideoSessionStatus.active,
        payment_status=PaymentStatus.authorized,
        provider_room_name=f"sabiodoc-autoclose-{uuid.uuid4().hex[:10]}",
        doctor_price_per_min_cents=appointment.doctor.price_per_min_cents,
        estimated_minutes=30,
        prepaid_amount_cents=0,
        billable_seconds=billable_seconds,
        expires_at=now + timedelta(hours=1),
        patient_present=False,
        doctor_present=not stale,
        patient_last_seen_at=last_seen,
        doctor_last_seen_at=last_seen,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _cleanup(db, *, user_ids, appointment_ids, session_ids) -> None:
    if session_ids:
        db.query(VideoSessionEvent).filter(
            VideoSessionEvent.video_session_id.in_(session_ids)
        ).delete(synchronize_session=False)
        db.query(VideoSession).filter(VideoSession.id.in_(session_ids)).delete(
            synchronize_session=False
        )
    if appointment_ids:
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
        db.query(Wallet).filter(Wallet.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(DoctorProfile).filter(DoctorProfile.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
    db.commit()


def test_no_cierra_una_sesion_con_presencia_reciente():
    db = SessionLocal()
    patient = _make_user(db)
    doctor_user = _make_user(db, UserRole.doctor)
    appointment = _make_appointment(db, patient, doctor_user)
    session = _make_session(db, appointment, stale=False)
    try:
        closed = video_session_service.expire_stale_sessions(db, doctor_id=appointment.doctor_id)

        db.refresh(session)
        assert session.status == VideoSessionStatus.active
        assert closed == 0
    finally:
        _cleanup(
            db,
            user_ids=[patient.id, doctor_user.id],
            appointment_ids=[appointment.id],
            session_ids=[session.id],
        )
        db.close()


def test_cierra_y_liquida_una_sesion_abandonada():
    db = SessionLocal()
    patient = _make_user(db)
    doctor_user = _make_user(db, UserRole.doctor)
    appointment = _make_appointment(db, patient, doctor_user)
    session = None
    try:
        wallet_service.topup(db, patient.id, 20000)
        db.commit()
        held = wallet_service.appointment_amount_cents(appointment)  # 30 min * 500 = 15000
        wallet_service.charge_appointment(db, appointment, held)
        db.commit()

        # 10 minutos facturables antes de abandonar la sala.
        session = _make_session(db, appointment, stale=True, billable_seconds=600)

        closed = video_session_service.expire_stale_sessions(db, doctor_id=appointment.doctor_id)
        assert closed == 1

        db.refresh(session)
        db.refresh(appointment)
        assert session.status == VideoSessionStatus.completed
        assert session.closed_reason == "auto_closed_inactivity"
        assert session.patient_present is False and session.doctor_present is False

        payment = (
            db.query(AppointmentPayment)
            .filter(AppointmentPayment.appointment_id == appointment.id)
            .first()
        )
        assert payment is not None
        assert payment.status == AppointmentPaymentStatus.released
        assert appointment.status == AppointmentStatus.completed
        # Se cobran 10 min * 500 = 5000; la diferencia de la retencion se devuelve.
        assert payment.billable_amount_cents == 5000
        assert wallet_service.get_balance_cents(db, patient.id) == 15000
        assert wallet_service.get_balance_cents(db, doctor_user.id) == 5000
    finally:
        _cleanup(
            db,
            user_ids=[patient.id, doctor_user.id],
            appointment_ids=[appointment.id],
            session_ids=[session.id] if session else [],
        )
        db.close()
