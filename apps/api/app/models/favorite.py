from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base import Base


class Favorite(Base):
    """Médico favorito de un paciente."""

    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", backref="favorites")
    doctor = relationship("DoctorProfile", backref="favorites")

    __table_args__ = (
        UniqueConstraint("user_id", "doctor_id", name="uq_user_doctor_favorite"),
    )
