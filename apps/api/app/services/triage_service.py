from typing import Optional
from sqlalchemy.orm import Session
from app.models.triage_request import TriageRequest
from app.models.user import User
from app.services.llm_client import llm_client
from app.core.logging import get_logger

logger = get_logger(__name__)


class TriageService:
    def process_triage(
        self,
        db: Session,
        symptoms_text: str,
        age: Optional[int] = None,
        sex: Optional[str] = None,
        user: Optional[User] = None
    ) -> dict:
        logger.info(f"Processing triage request for user_id={user.id if user else 'anonymous'}")
        
        result = llm_client.get_triage_response(
            symptoms_text=symptoms_text,
            age=age,
            sex=sex
        )
        
        triage_record = TriageRequest(
            user_id=user.id if user else None,
            symptoms_text=symptoms_text,
            result_json=result
        )
        db.add(triage_record)
        db.commit()
        db.refresh(triage_record)
        
        logger.info(f"Triage saved with id={triage_record.id}, urgency={result.get('urgency')}")
        
        return {
            "id": triage_record.id,
            "result": result,
            "created_at": triage_record.created_at
        }
        
    def get_user_history(
        self, 
        db: Session, 
        user_id: int, 
        limit: int = 3
    ) -> list[TriageRequest]:
        logger.info(f"Fetching triage history for user_id={user_id}")
        
        # Obtenemos las consultas del usuario, ordenadas por la más reciente
        records = db.query(TriageRequest)\
            .filter(TriageRequest.user_id == user_id)\
            .order_by(TriageRequest.created_at.desc())\
            .limit(limit)\
            .all()
            
        return records

triage_service = TriageService()