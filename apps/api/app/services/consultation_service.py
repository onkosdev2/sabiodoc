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
from app.models.chat_message import ChatMessage
from app.models.consultation import Consultation, ConsultationStatus

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

    Devuelve cuantas consultas se cerraron.
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
    for consultation in stale:
        consultation.status = ConsultationStatus.closed
        consultation.auto_closed = True
        consultation.closed_at = now
    db.commit()

    logger.info(f"Auto-closed {len(stale)} stale consultation(s) (user_id={user_id})")
    return len(stale)
