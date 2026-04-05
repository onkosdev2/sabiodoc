from pydantic import BaseModel
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
