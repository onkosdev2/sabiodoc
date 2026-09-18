from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.patient_profile import PatientProfile
from app.models.user import User
from app.schemas.patient import PatientProfileResponse, PatientProfileUpsert
from app.services.patient_profile_service import serialize_patient_profile

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/me/profile", response_model=PatientProfileResponse)
def get_my_patient_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    return serialize_patient_profile(profile, current_user)


@router.put("/me/profile", response_model=PatientProfileResponse)
def upsert_my_patient_profile(
    payload: PatientProfileUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not profile:
        profile = PatientProfile(user_id=current_user.id)
        db.add(profile)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return serialize_patient_profile(profile, current_user)
