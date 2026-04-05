from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict
from app.core.deps import get_db
from app.schemas.guide import GuideRequest, GuideRecommendation, GuideAnswer
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
