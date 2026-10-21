from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.consent import ConsentType
from app.models.user import User
from app.schemas.consent import ConsentResponse, ConsentRevokeRequest
from app.services.consent_service import consent_service

router = APIRouter(prefix="/consents", tags=["consents"])


@router.get("/me", response_model=list[ConsentResponse])
def list_my_consents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return consent_service.active_for_user(db, current_user.id)


@router.post("/revoke", response_model=dict)
def revoke_consent(
    payload: ConsentRevokeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    revoked = consent_service.revoke(
        db,
        user_id=current_user.id,
        consent_type=payload.consent_type,
        appointment_id=payload.appointment_id,
    )
    db.commit()
    return {"revoked": revoked}
