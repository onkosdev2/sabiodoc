from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from app.core.deps import get_db, get_current_user_optional
from app.models.user import User
from app.schemas.guide import (
    GuideRequest,
    GuideRecommendation,
    GuideStepRequest,
    GuideStepResponse,
)
from app.services.guide_service import guide_service
from app.core.logging import get_logger

router = APIRouter(prefix="/guide", tags=["guide"])
logger = get_logger(__name__)


@router.get("/questions")
def get_wizard_questions() -> List[Dict]:
    return guide_service.get_questions()


@router.post("/recommend", response_model=GuideRecommendation)
def get_recommendation(
    request: GuideRequest,
    db: Session = Depends(get_db)
):
    logger.info(f"Guide recommendation request with {len(request.answers)} answers")

    answers = [{"question_id": a.question_id, "answer": a.answer} for a in request.answers]
    result = guide_service.get_recommendation(db, answers)

    return GuideRecommendation(**result)


@router.post("/step", response_model=GuideStepResponse)
def guide_step(
    request: GuideStepRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Flujo conversacional con IA: devuelve la siguiente pregunta o la recomendación."""
    logger.info(f"Guide step request with {len(request.history)} answers")

    history = [item.model_dump() for item in request.history]
    result = guide_service.step(db, history)

    if result.get("status") == "recommendation":
        try:
            guide_service.record_recommendation(db, current_user, history, result)
        except Exception as exc:  # noqa: BLE001 - el historial no debe romper la respuesta
            logger.error(f"Could not persist guide recommendation: {exc}")

    return GuideStepResponse(**result)
