import json
from datetime import datetime, timezone
from fastapi import APIRouter, Header, HTTPException, Request, status, Depends
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.deps import get_db
from app.core.logging import get_logger
from app.models.doctor_presence import DoctorPresenceStatus
from app.models.video_session import VideoSession, VideoSessionStatus
from app.models.video_session_event import VideoSessionEvent

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = get_logger(__name__)


def _extract_room_name(payload: dict) -> str | None:
    room = payload.get("room") or {}
    if isinstance(room, dict):
        return room.get("name")
    return payload.get("room_name")


def _extract_event_name(payload: dict) -> str:
    return payload.get("type") or payload.get("event") or "unknown"


def _extract_participant_role(payload: dict) -> str | None:
    participant = payload.get("participant") or {}
    user_name = participant.get("user_name") or participant.get("username")
    if isinstance(user_name, str):
        if user_name.startswith("patient-"):
            return "patient"
        if user_name.startswith("doctor-"):
            return "doctor"
    return None


@router.post("/daily", status_code=status.HTTP_204_NO_CONTENT)
async def handle_daily_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_daily_signature: str | None = Header(default=None),
):
    if settings.DAILY_WEBHOOK_SECRET and not x_daily_signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Daily signature")

    payload = await request.json()
    event_name = _extract_event_name(payload)
    room_name = _extract_room_name(payload)

    if not room_name:
        logger.warning(f"Daily webhook without room_name: event={event_name}")
        return

    video_session = db.query(VideoSession).filter(VideoSession.provider_room_name == room_name).first()
    if not video_session:
        logger.warning(f"Daily webhook for unknown room: room_name={room_name}, event={event_name}")
        return

    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type=event_name,
            source="daily",
            payload_json=json.dumps(payload),
        )
    )

    if event_name in {"room.started", "meeting.started", "participant.joined"}:
        if video_session.status == VideoSessionStatus.prepared:
            video_session.status = VideoSessionStatus.active
            video_session.started_at = video_session.started_at or datetime.now(timezone.utc)
        role = _extract_participant_role(payload)
        joined_at = datetime.now(timezone.utc)
        if role == "patient":
            video_session.joined_patient_at = video_session.joined_patient_at or joined_at
            if video_session.appointment:
                video_session.appointment.joined_patient_at = video_session.appointment.joined_patient_at or joined_at
        if role == "doctor":
            video_session.joined_doctor_at = video_session.joined_doctor_at or joined_at
            if video_session.appointment:
                video_session.appointment.joined_doctor_at = video_session.appointment.joined_doctor_at or joined_at
        presence = video_session.doctor.presence if video_session.doctor else None
        if presence:
            presence.status = DoctorPresenceStatus.busy
            presence.status_message = "En videoconsulta"
            presence.last_seen_at = datetime.now(timezone.utc)

    if event_name in {"room.ended", "meeting.ended"}:
        video_session.status = VideoSessionStatus.completed
        video_session.ended_at = video_session.ended_at or datetime.now(timezone.utc)
        if video_session.started_at and video_session.ended_at:
            delta = video_session.ended_at - video_session.started_at
            video_session.billable_seconds = max(video_session.billable_seconds or 0, int(delta.total_seconds()))

        presence = video_session.doctor.presence if video_session.doctor else None
        if presence:
            presence.status = DoctorPresenceStatus.online
            presence.status_message = "En linea - Disponible ahora"
            presence.last_seen_at = datetime.now(timezone.utc)

    db.commit()
    logger.info(f"Daily webhook processed: room_name={room_name}, event={event_name}, video_session_id={video_session.id}")
