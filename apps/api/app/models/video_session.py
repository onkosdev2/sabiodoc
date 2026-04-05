import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class VideoSessionStatus(str, enum.Enum):
    prepared = "prepared"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"
    expired = "expired"
    failed = "failed"


class VideoProvider(str, enum.Enum):
    daily = "daily"
    mock_daily = "mock_daily"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    authorized = "authorized"
    captured = "captured"
    failed = "failed"
    waived = "waived"


class VideoSession(Base):
    __tablename__ = "video_sessions"

    id = Column(Integer, primary_key=True, index=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    provider = Column(Enum(VideoProvider), nullable=False)
    status = Column(Enum(VideoSessionStatus), nullable=False, default=VideoSessionStatus.prepared)
    payment_status = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.pending)
    provider_room_name = Column(String(255), nullable=False, unique=True)
    provider_room_url = Column(String(500), nullable=True)
    payment_reference = Column(String(255), nullable=True)
    doctor_price_per_min_cents = Column(Integer, nullable=False)
    estimated_minutes = Column(Integer, nullable=False)
    prepaid_amount_cents = Column(Integer, nullable=False)
    billable_seconds = Column(Integer, nullable=False, server_default="0")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    joined_patient_at = Column(DateTime(timezone=True), nullable=True)
    joined_doctor_at = Column(DateTime(timezone=True), nullable=True)
    doctor_note = Column(Text, nullable=True)
    followup_instructions = Column(Text, nullable=True)
    closed_reason = Column(String(120), nullable=True)
    ended_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    consultation = relationship("Consultation", backref="video_sessions")
    appointment = relationship("Appointment", backref="video_sessions")
    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("DoctorProfile", foreign_keys=[doctor_id])
    ended_by = relationship("User", foreign_keys=[ended_by_user_id])
