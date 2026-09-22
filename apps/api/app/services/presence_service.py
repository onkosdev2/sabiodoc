"""Presencia real de los medicos.

La presencia no se guarda como un estado inventado: se **deriva** de datos
reales:
- ``last_seen_at``: ultima actividad autenticada (heartbeat del frontend).
- sesiones de video activas y vigentes.
- ``is_accepting_consultations``.

Estados resultantes (etiquetas):
- "En sesion"   -> tiene una videoconsulta activa.
- "Disponible"  -> activo recientemente y aceptando consultas.
- "No disponible" -> activo pero no esta aceptando consultas.
- "Desconectado" -> sin actividad reciente.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.doctor_presence import DoctorPresence, DoctorPresenceStatus
from app.models.doctor_profile import DoctorProfile
from app.models.video_session import VideoSession, VideoSessionStatus


@dataclass
class ResolvedPresence:
    status: DoctorPresenceStatus
    status_message: str
    last_seen_at: datetime | None


def _online_window() -> timedelta:
    return timedelta(minutes=settings.DOCTOR_PRESENCE_ONLINE_MINUTES)


def is_recently_seen(last_seen_at: datetime | None, now: datetime | None = None) -> bool:
    if last_seen_at is None:
        return False
    now = now or datetime.now(UTC)
    return last_seen_at >= now - _online_window()


def _session_presence_window() -> timedelta:
    # Un poco más amplio que el timeout de facturación para tolerar el
    # throttling de timers en pestañas en segundo plano.
    return timedelta(seconds=max(settings.VIDEO_PRESENCE_TIMEOUT_SECONDS * 2, 60))


def doctor_has_active_session(db: Session, doctor_profile_id: int, now: datetime | None = None) -> bool:
    now = now or datetime.now(UTC)
    session = (
        db.query(VideoSession)
        .filter(
            VideoSession.doctor_id == doctor_profile_id,
            VideoSession.status == VideoSessionStatus.active,
            VideoSession.expires_at > now,
        )
        .order_by(VideoSession.created_at.desc())
        .first()
    )
    if session is None:
        return False

    # "En sesión" solo si el médico sigue realmente en la sala. Si cerró la
    # videollamada (o dejó de dar señales), la sesión pudo quedar 'active' pero
    # el médico no debe aparecer como ocupado indefinidamente.
    if not session.doctor_present:
        return False
    if session.doctor_last_seen_at is None:
        return False
    return session.doctor_last_seen_at >= now - _session_presence_window()


def resolve_presence(
    db: Session,
    doctor_profile: DoctorProfile,
    *,
    now: datetime | None = None,
    has_active_session: bool | None = None,
) -> ResolvedPresence:
    """Calcula la presencia real de un medico."""
    now = now or datetime.now(UTC)
    presence = doctor_profile.presence
    last_seen_at = presence.last_seen_at if presence else None

    if has_active_session is None:
        has_active_session = doctor_has_active_session(db, doctor_profile.id, now)

    if has_active_session:
        return ResolvedPresence(DoctorPresenceStatus.busy, "En sesión", last_seen_at)

    if not is_recently_seen(last_seen_at, now):
        return ResolvedPresence(DoctorPresenceStatus.offline, "Desconectado", last_seen_at)

    if not doctor_profile.is_accepting_consultations:
        return ResolvedPresence(DoctorPresenceStatus.offline, "No disponible", last_seen_at)

    return ResolvedPresence(DoctorPresenceStatus.online, "Disponible", last_seen_at)


def touch_presence(db: Session, doctor_profile: DoctorProfile, *, now: datetime | None = None) -> DoctorPresence:
    """Marca al medico como activo ahora (heartbeat)."""
    now = now or datetime.now(UTC)
    presence = doctor_profile.presence
    if presence is None:
        presence = DoctorPresence(doctor_id=doctor_profile.id)
        db.add(presence)
    presence.last_seen_at = now
    resolved = resolve_presence(db, doctor_profile, now=now)
    presence.status = resolved.status
    presence.status_message = resolved.status_message
    db.commit()
    db.refresh(presence)
    return presence
