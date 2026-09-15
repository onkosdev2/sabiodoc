from pydantic import BaseModel, Field
from typing import List, Optional


class GuideAnswer(BaseModel):
    question_id: str
    answer: str


class GuideRequest(BaseModel):
    answers: List[GuideAnswer]


class GuideRecommendation(BaseModel):
    recommended_specialty_slug: str
    recommended_specialty_name: str
    confidence: str
    reason: str
    disclaimer: str


# --- Flujo conversacional con IA (opción múltiple) ---------------------------------

class GuideHistoryItem(BaseModel):
    question_id: str
    question: str
    answer: str
    answer_label: str


class GuideStepRequest(BaseModel):
    history: List[GuideHistoryItem] = Field(default_factory=list)


class GuideOption(BaseModel):
    value: str
    label: str


class GuideAlternative(BaseModel):
    specialty_slug: str
    reason: str


class GuideStepResponse(BaseModel):
    status: str = Field(..., pattern="^(question|recommendation)$")
    step: int = 1
    max_steps: int = 5

    # Cuando status == "question"
    question_id: Optional[str] = None
    question: Optional[str] = None
    options: List[GuideOption] = Field(default_factory=list)

    # Cuando status == "recommendation"
    recommended_specialty_slug: Optional[str] = None
    recommended_specialty_name: Optional[str] = None
    confidence: Optional[str] = None
    reason: Optional[str] = None
    rationale_bullets: List[str] = Field(default_factory=list)
    clarifying_questions: List[str] = Field(default_factory=list)
    alternatives: List[GuideAlternative] = Field(default_factory=list)
    urgency: str = "medium"
    red_flags_detected: List[str] = Field(default_factory=list)
    disclaimer: str = ""
