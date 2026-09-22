from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.patient_profile_change_request import PatientProfileChangeStatus
from app.schemas.patient import PatientProfileUpsert


class PatientProfileChangeRequestCreate(PatientProfileUpsert):
    """Datos propuestos por el médico (mismos campos que el perfil del paciente)."""

    doctor_message: Optional[str] = Field(default=None, max_length=2000)


class PatientProfileChangeResolve(BaseModel):
    action: Literal["approve", "reject"]
    patient_note: Optional[str] = Field(default=None, max_length=2000)


class PatientProfileChangeRequestResponse(BaseModel):
    id: int
    patient_id: int
    patient_email: Optional[str] = None
    patient_name: Optional[str] = None
    doctor_id: Optional[int] = None
    doctor_name: Optional[str] = None
    status: PatientProfileChangeStatus
    proposed_changes: dict = Field(default_factory=dict)
    current_snapshot: dict = Field(default_factory=dict)
    doctor_message: Optional[str] = None
    patient_note: Optional[str] = None
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
