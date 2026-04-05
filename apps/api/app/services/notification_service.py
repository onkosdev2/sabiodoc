import json

from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationStatus


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
        return notification


notification_service = NotificationService()
