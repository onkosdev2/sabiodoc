import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, backref
from app.db.base import Base


class DoctorApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    suspended = "suspended"


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    display_name = Column(String(255), nullable=False)
    professional_title = Column(String(255), nullable=True)
    bio_short = Column(Text, nullable=True)
    price_per_min_cents = Column(Integer, nullable=False)
    license_number = Column(String(120), nullable=True)
    license_country = Column(String(120), nullable=True)
    country = Column(String(120), nullable=True)
    city = Column(String(120), nullable=True)
    timezone = Column(String(120), nullable=True, server_default="UTC")
    government_id = Column(String(120), nullable=True)
    years_experience = Column(Integer, nullable=True)
    review_notes = Column(Text, nullable=True)
    rating_avg = Column(Numeric(3, 2), nullable=False, server_default="0")
    rating_count = Column(Integer, nullable=False, server_default="0")
    is_accepting_consultations = Column(Boolean, nullable=False, server_default="true")
    status = Column(Enum(DoctorApprovalStatus), nullable=False, server_default=DoctorApprovalStatus.pending.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref=backref("doctor_profile", uselist=False), uselist=False)
