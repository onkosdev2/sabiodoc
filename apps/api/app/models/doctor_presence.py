import enum
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Enum, String
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, backref
from app.db.base import Base


class DoctorPresenceStatus(str, enum.Enum):
    offline = "offline"
    online = "online"
    busy = "busy"


class DoctorPresence(Base):
    __tablename__ = "doctor_presences"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False, unique=True)
    status = Column(Enum(DoctorPresenceStatus), nullable=False, default=DoctorPresenceStatus.offline)
    status_message = Column(String(255), nullable=True)
    last_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    doctor = relationship("DoctorProfile", backref=backref("presence", uselist=False), uselist=False)
