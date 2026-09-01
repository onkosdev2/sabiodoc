from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.consultation import ConsultationStatus
from app.schemas.specialty import SpecialtyResponse


class ConsultationStructuredIntake(BaseModel):
    chief_complaint: Optional[str] = None
    symptom_summary: list[str] = []
    duration_and_evolution: Optional[str] = None
    current_medications: list[str] = []
    relevant_history: list[str] = []
    risk_factors: list[str] = []
    red_flags: list[str] = []
    recommended_focus_for_doctor: list[str] = []
    patient_questions_or_goals: list[str] = []
    completeness: Optional[str] = None


class ConsultationCreate(BaseModel):
    specialty_id: int


class ConsultationResponse(BaseModel):
    id: int
    specialty_id: int
    status: ConsultationStatus
    room_id: str
    created_at: datetime
    closed_at: Optional[datetime] = None
    summary: Optional[str] = None
    intake: Optional[ConsultationStructuredIntake] = None
    specialty: Optional[SpecialtyResponse] = None
    
    model_config = ConfigDict(from_attributes=True)


class ConsultationListResponse(BaseModel):
    consultations: list[ConsultationResponse]
    total: int
