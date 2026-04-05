from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class VideoSessionEvent(Base):
    __tablename__ = "video_session_events"

    id = Column(Integer, primary_key=True, index=True)
    video_session_id = Column(Integer, ForeignKey("video_sessions.id"), nullable=False)
    event_type = Column(String(100), nullable=False)
    source = Column(String(50), nullable=False)
    payload_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    video_session = relationship("VideoSession", backref="events")
