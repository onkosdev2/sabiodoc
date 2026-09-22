import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class PatientProfileChangeStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class PatientProfileChangeRequest(Base):
    """Propuesta de cambio de datos del paciente hecha por un médico.

    El médico no modifica el perfil directamente: propone los campos nuevos y el
    paciente decide si los acepta o los rechaza. Esto evita que un error de
    tipeo o una interpretación equivocada altere datos clínicos sensibles.
    """

    __tablename__ = "patient_profile_change_requests"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_profile_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    status = Column(
        Enum(PatientProfileChangeStatus),
        nullable=False,
        default=PatientProfileChangeStatus.pending,
        server_default=PatientProfileChangeStatus.pending.value,
    )
    # JSON con los campos propuestos: {"campo": {"from": ..., "to": ...}}
    proposed_changes = Column(Text, nullable=False)
    # JSON con el perfil vigente al momento de proponer (para mostrar el antes).
    current_snapshot = Column(Text, nullable=False)
    doctor_message = Column(Text, nullable=True)
    patient_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    patient = relationship("User", foreign_keys=[patient_id])
    doctor_profile = relationship("DoctorProfile", foreign_keys=[doctor_profile_id])
