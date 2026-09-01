from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import datetime


class TriageRequest(BaseModel):
    symptoms_text: str = Field(..., min_length=10, description="Descripción de los síntomas")
    age: Optional[int] = Field(None, ge=0, le=150)
    sex: Optional[str] = Field(None, pattern="^(male|female|other)$")


class AlternativeSpecialty(BaseModel):
    specialty_slug: str
    reason: str


class TriageResult(BaseModel):
    urgency: str = Field(..., pattern="^(low|medium|high|emergency)$")
    recommended_specialty_slug: str
    rationale_bullets: List[str]
    clarifying_questions: List[str] = Field(default_factory=list, max_length=5)
    alternatives: List[AlternativeSpecialty] = Field(default_factory=list, max_length=3)
    red_flags_detected: List[str] = Field(default_factory=list)
    disclaimer: str


class TriageResponse(BaseModel):
    id: int
    result: TriageResult
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
