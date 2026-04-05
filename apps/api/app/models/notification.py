import enum

from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, Enum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base import Base


class NotificationStatus(str, enum.Enum):
    unread = "unread"
    read = "read"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(120), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    action_url = Column(String(500), nullable=True)
    metadata_json = Column(Text, nullable=True)
    status = Column(Enum(NotificationStatus), nullable=False, default=NotificationStatus.unread)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", backref="notifications")
