from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.notification import NotificationStatus


class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    body: str
    action_url: Optional[str] = None
    action_label: Optional[str] = None
    status: NotificationStatus
    created_at: datetime
    read_at: Optional[datetime] = None
    metadata: dict | None = None

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    unread: int
