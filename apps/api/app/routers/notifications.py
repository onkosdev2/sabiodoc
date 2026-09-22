import asyncio
import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.notification import Notification, NotificationStatus
from app.models.user import User
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.services.notification_broker import subscribe, unsubscribe
from app.services.notification_service import serialize_notification
from app.services.reminder_service import reminder_service

router = APIRouter(prefix="/notifications", tags=["notifications"])

# Cada cuánto se envía un comentario para mantener viva la conexión SSE.
SSE_KEEPALIVE_SECONDS = 25


def _serialize_notification(notification: Notification) -> NotificationResponse:
    return NotificationResponse.model_validate(serialize_notification(notification))


@router.get("/my", response_model=NotificationListResponse)
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reminder_service.process_due_reminders(db)
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    unread = sum(1 for item in notifications if item.status == NotificationStatus.unread)
    return NotificationListResponse(
        notifications=[_serialize_notification(item) for item in notifications],
        total=len(notifications),
        unread=unread,
    )


@router.get("/stream")
async def stream_notifications(current_user: User = Depends(get_current_user)):
    """Server-Sent Events con las notificaciones nuevas del usuario."""
    queue = subscribe(current_user.id)

    async def event_generator():
        try:
            yield ": conectado\n\n"
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=SSE_KEEPALIVE_SECONDS)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                yield f"event: notification\ndata: {json.dumps(payload, ensure_ascii=True)}\n\n"
        finally:
            unsubscribe(current_user.id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notificacion no encontrada")
    notification.status = NotificationStatus.read
    notification.read_at = datetime.now(UTC)
    db.commit()
    db.refresh(notification)
    return _serialize_notification(notification)


@router.post("/read-all", response_model=NotificationListResponse)
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    for notification in notifications:
        notification.status = NotificationStatus.read
        notification.read_at = datetime.now(UTC)
    db.commit()
    return NotificationListResponse(
        notifications=[_serialize_notification(item) for item in notifications],
        total=len(notifications),
        unread=0,
    )
