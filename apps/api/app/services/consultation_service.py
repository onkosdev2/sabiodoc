"""Consultas IA: reglas de ciclo de vida.

Incluye el cierre perezoso de borradores inactivos. En lugar de depender de un
scheduler externo, el barrido se ejecuta cuando se leen o crean consultas
(patron "sweep on read"): es barato porque siempre esta acotado a un usuario.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.appointment import Appointment
from app.models.chat_message import ChatMessage, MessageRole
from app.models.consultation import Consultation, ConsultationStatus
from app.models.video_session import VideoSession

logger = get_logger(__name__)


def close_stale_consultations(
    db: Session,
    *,
    user_id: int | None = None,
    ttl_hours: int | None = None,
) -> int:
    """Cierra consultas IA abiertas sin actividad reciente.

    "Actividad" = fecha del ultimo mensaje del chat; si nunca hubo mensajes,
    se usa la fecha de creacion. Un borrador (`created`) o una consulta
    `active` que llevan mas de `ttl_hours` sin movimiento se cierran y se
    marcan con `auto_closed=True`.

    Excepcion: los borradores donde el usuario nunca escribio nada (por ejemplo,
    un clic accidental al crear la consulta) se eliminan por completo en lugar
    de cerrarse, para no dejar registros sin valor clinico en el historial.

    Devuelve cuantas consultas se cerraron (no cuenta las purgadas).
    """
    ttl = ttl_hours if ttl_hours is not None else settings.CONSULTATION_DRAFT_TTL_HOURS
    if ttl <= 0:
        return 0

    cutoff = datetime.now(UTC) - timedelta(hours=ttl)

    last_message = (
        db.query(
            ChatMessage.consultation_id.label("consultation_id"),
            func.max(ChatMessage.created_at).label("last_at"),
        )
        .group_by(ChatMessage.consultation_id)
        .subquery()
    )
    last_activity = func.coalesce(last_message.c.last_at, Consultation.created_at)

    query = (
        db.query(Consultation)
        .outerjoin(last_message, last_message.c.consultation_id == Consultation.id)
        .filter(
            Consultation.status.in_([ConsultationStatus.created, ConsultationStatus.active]),
            last_activity < cutoff,
        )
    )
    if user_id is not None:
        query = query.filter(Consultation.user_id == user_id)

    stale = query.all()
    if not stale:
        return 0

    now = datetime.now(UTC)

    # Borradores donde el paciente nunca envio un mensaje: no hubo intencion
    # real de consultar, asi que no aportan nada al historial.
    draft_ids = [c.id for c in stale if c.status == ConsultationStatus.created]
    engaged_draft_ids: set[int] = set()
    if draft_ids:
        engaged_draft_ids = {
            row[0]
            for row in db.query(ChatMessage.consultation_id)
            .filter(
                ChatMessage.consultation_id.in_(draft_ids),
                ChatMessage.role == MessageRole.user,
            )
            .distinct()
        }

    abandoned_drafts = [
        c for c in stale
        if c.status == ConsultationStatus.created and c.id not in engaged_draft_ids
    ]

    # Defensa: si un borrador tuviera una cita o videoconsulta vinculada,
    # se conserva (se cierra) en lugar de borrarse.
    if abandoned_drafts:
        abandoned_ids = [c.id for c in abandoned_drafts]
        linked_ids = {
            row[0]
            for row in db.query(Appointment.consultation_id)
            .filter(Appointment.consultation_id.in_(abandoned_ids))
            .distinct()
        }
        linked_ids |= {
            row[0]
            for row in db.query(VideoSession.consultation_id)
            .filter(VideoSession.consultation_id.in_(abandoned_ids))
            .distinct()
        }
        abandoned_drafts = [c for c in abandoned_drafts if c.id not in linked_ids]
        abandoned_ids = [c.id for c in abandoned_drafts]
    else:
        abandoned_ids = []

    if abandoned_ids:
        db.query(ChatMessage).filter(ChatMessage.consultation_id.in_(abandoned_ids)).delete(
            synchronize_session=False
        )
        for consultation in abandoned_drafts:
            db.delete(consultation)

    abandoned_id_set = set(abandoned_ids)

    closed_count = 0
    for consultation in stale:
        if consultation.id in abandoned_id_set:
            continue
        consultation.status = ConsultationStatus.closed
        consultation.auto_closed = True
        consultation.closed_at = now
        closed_count += 1
    db.commit()

    logger.info(
        f"Auto-closed {closed_count} stale consultation(s); "
        f"purged {len(abandoned_ids)} untouched draft(s) (user_id={user_id})"
    )
    return closed_count
