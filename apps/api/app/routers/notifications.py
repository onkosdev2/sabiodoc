import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.notification import Notification, NotificationStatus
from app.models.user import User
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.services.reminder_service import reminder_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _serialize_notification(notification: Notification) -> NotificationResponse:
    metadata = json.loads(notification.metadata_json) if notification.metadata_json else {}
    return NotificationResponse.model_validate(
        {
            "id": notification.id,
            "type": notification.type,
            "title": notification.title,
            "body": notification.body,
            "action_url": notification.action_url,
            "action_label": metadata.get("action_label"),
            "status": notification.status,
            "created_at": notification.created_at,
            "read_at": notification.read_at,
            "metadata": metadata,
        }
    )


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
    notifications = db.query(Notification).filter(Notification.user_id == current_user.id).all()
    for notification in notifications:
        notification.status = NotificationStatus.read
        notification.read_at = datetime.now(UTC)
    db.commit()
    return NotificationListResponse(
        notifications=[_serialize_notification(item) for item in notifications],
        total=len(notifications),
        unread=0,
    )
