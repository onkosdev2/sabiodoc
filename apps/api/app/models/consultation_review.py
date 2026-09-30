from sqlalchemy import Boolean, Column, Integer, ForeignKey, Text, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, backref

from app.db.base import Base


class ConsultationReview(Base):
    __tablename__ = "consultation_reviews"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, unique=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    # Moderación: una reseña oculta deja de mostrarse y no cuenta para el rating.
    is_hidden = Column(Boolean, nullable=False, server_default="false", default=False)
    hidden_reason = Column(Text, nullable=True)
    hidden_at = Column(DateTime(timezone=True), nullable=True)
    hidden_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    appointment = relationship("Appointment", backref=backref("review", cascade="all, delete-orphan"))
    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("DoctorProfile", foreign_keys=[doctor_id])
    hidden_by = relationship("User", foreign_keys=[hidden_by_id])
