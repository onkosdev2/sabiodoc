from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class DoctorSpecialty(Base):
    __tablename__ = "doctor_specialties"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    specialty_id = Column(Integer, ForeignKey("specialties.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    doctor = relationship("DoctorProfile", backref="doctor_specialties")
    specialty = relationship("Specialty", backref="doctor_specialties")

    __table_args__ = (
        UniqueConstraint("doctor_id", "specialty_id", name="uq_doctor_specialty"),
    )
