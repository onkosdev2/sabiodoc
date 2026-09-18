"""La presencia del medico se deriva de actividad real y sesiones."""

import uuid
from datetime import UTC, datetime, timedelta

from app.db.session import SessionLocal
from app.models.doctor_profile import DoctorProfile
from app.models.video_session import (
    PaymentStatus,
    VideoProvider,
    VideoSession,
    VideoSessionStatus,
)
from app.models.video_session_event import VideoSessionEvent
from app.services.presence_service import resolve_presence, touch_presence


def test_presence_is_derived_from_activity_and_sessions():
    db = SessionLocal()
    video_session_id = None
    doctor = None
    original = None
    try:
        doctor = db.query(DoctorProfile).first()
        assert doctor is not None
        presence = doctor.presence
        assert presence is not None
        original = (presence.last_seen_at, presence.status, presence.status_message, doctor.is_accepting_consultations)

        # Sin actividad reciente -> Desconectado
        presence.last_seen_at = datetime.now(UTC) - timedelta(hours=1)
        doctor.is_accepting_consultations = True
        db.commit()
        assert resolve_presence(db, doctor).status_message == "Desconectado"

        # Con heartbeat reciente -> Disponible
        touch_presence(db, doctor)
        assert resolve_presence(db, doctor).status_message == "Disponible"

        # Activo pero sin aceptar consultas -> No disponible
        doctor.is_accepting_consultations = False
        db.commit()
        assert resolve_presence(db, doctor).status_message == "No disponible"
        doctor.is_accepting_consultations = True
        db.commit()

        # Con una videoconsulta activa -> En sesión
        now = datetime.now(UTC)
        video_session = VideoSession(
            patient_id=doctor.user_id,
            doctor_id=doctor.id,
            provider=VideoProvider.jitsi_mock,
            status=VideoSessionStatus.active,
            payment_status=PaymentStatus.pending,
            provider_room_name=f"sabiodoc-presence-{uuid.uuid4().hex[:10]}",
            doctor_price_per_min_cents=2200,
            estimated_minutes=30,
            prepaid_amount_cents=0,
            expires_at=now + timedelta(minutes=30),
            started_at=now,
        )
        db.add(video_session)
        db.commit()
        db.refresh(video_session)
        video_session_id = video_session.id
        assert resolve_presence(db, doctor).status_message == "En sesión"
    finally:
        if video_session_id is not None:
            db.query(VideoSessionEvent).filter(
                VideoSessionEvent.video_session_id == video_session_id
            ).delete(synchronize_session=False)
            db.query(VideoSession).filter(VideoSession.id == video_session_id).delete(
                synchronize_session=False
            )
        if doctor is not None and original is not None:
            last_seen_at, status, status_message, accepting = original
            doctor.presence.last_seen_at = last_seen_at
            doctor.presence.status = status
            doctor.presence.status_message = status_message
            doctor.is_accepting_consultations = accepting
        db.commit()
        db.close()
