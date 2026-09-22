import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationStatus


def serialize_notification(notification: Notification) -> dict:
    """Payload JSON-ready de una notificación (REST y SSE)."""
    metadata = json.loads(notification.metadata_json) if notification.metadata_json else {}
    created_at = notification.created_at or datetime.now(UTC)
    return {
        "id": notification.id,
        "type": notification.type,
        "title": notification.title,
        "body": notification.body,
        "action_url": notification.action_url,
        "action_label": metadata.get("action_label"),
        "status": notification.status.value
        if hasattr(notification.status, "value")
        else notification.status,
        "created_at": created_at.isoformat(),
        "read_at": notification.read_at.isoformat() if notification.read_at else None,
        "metadata": metadata,
    }


class NotificationService:
    def create(
        self,
        db: Session,
        *,
        user_id: int,
        notification_type: str,
        title: str,
        body: str,
        action_url: str | None = None,
        metadata: dict | None = None,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            type=notification_type,
            title=title,
            body=body,
            action_url=action_url,
            metadata_json=json.dumps(metadata or {}, ensure_ascii=True),
            status=NotificationStatus.unread,
        )
        db.add(notification)
        db.flush()

        # Se publica al confirmar la transacción (ver notification_broker).
        db.info.setdefault("pending_notifications", []).append(
            (user_id, serialize_notification(notification))
        )
        return notification


notification_service = NotificationService()
