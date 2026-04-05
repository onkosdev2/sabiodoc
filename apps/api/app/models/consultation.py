from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum


class ConsultationStatus(str, enum.Enum):
    created = "created"
    active = "active"
    closed = "closed"


class Consultation(Base):
    __tablename__ = "consultations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    specialty_id = Column(Integer, ForeignKey("specialties.id"), nullable=False)
    status = Column(Enum(ConsultationStatus), default=ConsultationStatus.created, nullable=False)
    room_id = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)
    summary = Column(Text, nullable=True)
    intake_json = Column(JSONB, nullable=True)
    
    user = relationship("User", backref="consultations")
    specialty = relationship("Specialty", backref="consultations")
