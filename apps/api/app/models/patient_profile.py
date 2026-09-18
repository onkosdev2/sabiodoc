import enum

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import backref, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class PatientSex(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"


class PatientProfile(Base):
    """Datos personales y clínicos básicos del paciente.

    Sirven para que el médico reconozca al paciente y para dar contexto a la IA
    en las consultas (alergias, medicación, antecedentes, etc.).
    """

    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)

    # Datos personales
    first_name = Column(String(120), nullable=True)
    last_name = Column(String(120), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    sex = Column(Enum(PatientSex), nullable=True)
    phone = Column(String(40), nullable=True)
    country = Column(String(120), nullable=True)
    city = Column(String(120), nullable=True)
    timezone = Column(String(120), nullable=True, server_default="UTC")

    # Datos clínicos
    blood_type = Column(String(10), nullable=True)
    allergies = Column(Text, nullable=True)
    chronic_conditions = Column(Text, nullable=True)
    current_medications = Column(Text, nullable=True)
    family_history = Column(Text, nullable=True)
    height_cm = Column(Integer, nullable=True)
    weight_kg = Column(Integer, nullable=True)
    smoker = Column(Boolean, nullable=True)
    alcohol = Column(Boolean, nullable=True)

    # Contacto de emergencia y notas
    emergency_contact_name = Column(String(160), nullable=True)
    emergency_contact_phone = Column(String(40), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref=backref("patient_profile", uselist=False), uselist=False)
