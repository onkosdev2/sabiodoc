"""Auto-cierre de borradores de consulta IA inactivos."""

import uuid
from datetime import UTC, datetime, timedelta

from app.db.session import SessionLocal
from app.models.chat_message import ChatMessage, MessageRole
from app.models.consultation import Consultation, ConsultationStatus
from app.models.specialty import Specialty
from app.models.user import User, UserRole
from app.services.consultation_service import close_stale_consultations


def _make_user(db) -> User:
    user = User(
        email=f"cleanup_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="x",
        role=UserRole.patient,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _cleanup(db, *, user_id: int | None, consultation_ids: list[int]) -> None:
    if consultation_ids:
        db.query(ChatMessage).filter(ChatMessage.consultation_id.in_(consultation_ids)).delete(
            synchronize_session=False
        )
        db.query(Consultation).filter(Consultation.id.in_(consultation_ids)).delete(
            synchronize_session=False
        )
    if user_id is not None:
        db.query(User).filter(User.id == user_id).delete(synchronize_session=False)
    db.commit()


def test_close_stale_consultations_closes_idle_drafts_only():
    db = SessionLocal()
    user_id = None
    ids: list[int] = []
    try:
        user = _make_user(db)
        user_id = user.id
        specialty = db.query(Specialty).first()
        assert specialty is not None

        stale = Consultation(
            user_id=user.id,
            specialty_id=specialty.id,
            room_id=f"room-stale-{uuid.uuid4().hex[:8]}",
            status=ConsultationStatus.created,
        )
        fresh = Consultation(
            user_id=user.id,
            specialty_id=specialty.id,
            room_id=f"room-fresh-{uuid.uuid4().hex[:8]}",
            status=ConsultationStatus.active,
        )
        db.add_all([stale, fresh])
        db.commit()
        db.refresh(stale)
        db.refresh(fresh)
        ids = [stale.id, fresh.id]

        # Borrador antiguo con su ultimo mensaje hace 30 dias.
        old = datetime.now(UTC) - timedelta(days=30)
        stale.created_at = old
        db.add(ChatMessage(consultation_id=stale.id, role=MessageRole.user, content="hola", created_at=old))
        # Consulta activa con actividad reciente: no debe cerrarse.
        db.add(
            ChatMessage(
                consultation_id=fresh.id,
                role=MessageRole.user,
                content="reciente",
                created_at=datetime.now(UTC),
            )
        )
        db.commit()

        closed = close_stale_consultations(db, user_id=user.id, ttl_hours=24)
        assert closed == 1

        db.refresh(stale)
        db.refresh(fresh)
        assert stale.status == ConsultationStatus.closed
        assert stale.auto_closed is True
        assert stale.closed_at is not None
        assert fresh.status == ConsultationStatus.active
        assert fresh.auto_closed is False
    finally:
        _cleanup(db, user_id=user_id, consultation_ids=ids)
        db.close()


def test_close_stale_consultations_keeps_recent_creation():
    db = SessionLocal()
    user_id = None
    ids: list[int] = []
    try:
        user = _make_user(db)
        user_id = user.id
        specialty = db.query(Specialty).first()
        assert specialty is not None

        recent = Consultation(
            user_id=user.id,
            specialty_id=specialty.id,
            room_id=f"room-recent-{uuid.uuid4().hex[:8]}",
            status=ConsultationStatus.created,
        )
        db.add(recent)
        db.commit()
        db.refresh(recent)
        ids = [recent.id]

        # Recien creada: no se cierra aunque el TTL sea de 24 h.
        assert close_stale_consultations(db, user_id=user.id, ttl_hours=24) == 0
        db.refresh(recent)
        assert recent.status == ConsultationStatus.created
        assert recent.auto_closed is False
    finally:
        _cleanup(db, user_id=user_id, consultation_ids=ids)
        db.close()


def test_close_stale_consultations_disabled_with_non_positive_ttl():
    db = SessionLocal()
    try:
        assert close_stale_consultations(db, ttl_hours=0) == 0
    finally:
        db.close()
