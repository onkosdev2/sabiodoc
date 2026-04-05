from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from app.core.deps import get_db, get_current_user_optional
from app.models.user import User
from app.schemas.triage import TriageRequest, TriageResponse, TriageResult
from app.services.triage_service import triage_service
from app.core.logging import get_logger

router = APIRouter(prefix="/ai", tags=["ai"])
logger = get_logger(__name__)


@router.post("/triage", response_model=TriageResponse)
def process_triage(
    request: TriageRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    logger.info(f"Triage request received, symptoms length: {len(request.symptoms_text)}")
    
    result = triage_service.process_triage(
        db=db,
        symptoms_text=request.symptoms_text,
        age=request.age,
        sex=request.sex,
        user=current_user
    )
    
    return TriageResponse(
        id=result["id"],
        result=TriageResult(**result["result"]),
        created_at=result["created_at"]
    )
