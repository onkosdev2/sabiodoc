import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text, Index
from sqlalchemy.sql import func

from app.db.base import Base


class ConsentType(str, enum.Enum):
    terms = "terms"
    privacy = "privacy"
    clinical_data = "clinical_data"
    telemedicine = "telemedicine"
    transcription = "transcription"
    recording = "recording"
    marketing = "marketing"


class Consent(Base):
    __tablename__ = "consents"
    __table_args__ = (
        Index("ix_consents_user_type", "user_id", "consent_type"),
        Index("ix_consents_appointment", "appointment_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=True)
    consent_type = Column(Enum(ConsentType), nullable=False)
    version = Column(String(50), nullable=False)
    accepted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)
    metadata_json = Column(Text, nullable=True)
