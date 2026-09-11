from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
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

@router.get("/triage/history", response_model=List[TriageResponse])
def get_triage_history(
    limit: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    
    records = triage_service.get_user_history(
        db=db,
        user_id=current_user.id,
        limit=limit
    )
    
    responses = []
    for record in records:
        responses.append(
            TriageResponse(
                id=record.id,
                result=TriageResult(**record.result_json),
                created_at=record.created_at
            )
        )
        
    return responses