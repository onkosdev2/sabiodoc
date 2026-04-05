import enum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base import Base


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=True, index=True)
    specialty_id = Column(Integer, ForeignKey("specialties.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    status = Column(Enum(AppointmentStatus), nullable=False, default=AppointmentStatus.scheduled)
    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    duration_minutes = Column(Integer, nullable=False)
    patient_note = Column(Text, nullable=True)
    ai_summary_snapshot = Column(Text, nullable=True)
    ai_intake_snapshot_json = Column(JSONB, nullable=True)
    doctor_note = Column(Text, nullable=True)
    followup_instructions = Column(Text, nullable=True)
    booked_via_ai = Column(Boolean, nullable=False, server_default="false")
    consent_accepted_at = Column(DateTime(timezone=True), nullable=True)
    consent_text_version = Column(String(50), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    joined_patient_at = Column(DateTime(timezone=True), nullable=True)
    joined_doctor_at = Column(DateTime(timezone=True), nullable=True)
    no_show_marked_at = Column(DateTime(timezone=True), nullable=True)
    day_reminder_sent_at = Column(DateTime(timezone=True), nullable=True)
    hour_reminder_sent_at = Column(DateTime(timezone=True), nullable=True)
    review_reminder_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    consultation = relationship("Consultation", backref="appointments")
    specialty = relationship("Specialty")
    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("DoctorProfile", foreign_keys=[doctor_id])
