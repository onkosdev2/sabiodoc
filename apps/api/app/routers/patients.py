from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.patient_profile import PatientProfile
from app.models.patient_profile_change_request import PatientProfileChangeRequest, PatientProfileChangeStatus
from app.models.user import User
from app.schemas.patient import PatientProfileResponse, PatientProfileUpsert
from app.schemas.patient_profile_change import (
    PatientProfileChangeRequestResponse,
    PatientProfileChangeResolve,
)
from app.services.notification_service import notification_service
from app.services.patient_profile_change_service import (
    list_pending_for_patient,
    resolve_change_request,
    serialize_change_request,
)
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


@router.get("/me/profile-change-requests", response_model=list[PatientProfileChangeRequestResponse])
def get_my_profile_change_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Solicitudes de cambio de perfil propuestas por médicos y aún pendientes."""
    requests = list_pending_for_patient(db, current_user.id)
    return [serialize_change_request(db, request) for request in requests]


@router.post(
    "/me/profile-change-requests/{request_id}/resolve",
    response_model=PatientProfileChangeRequestResponse,
)
def resolve_my_profile_change_request(
    request_id: int,
    payload: PatientProfileChangeResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """El paciente aprueba o rechaza una propuesta de cambio de sus datos."""
    request = (
        db.query(PatientProfileChangeRequest)
        .filter(
            PatientProfileChangeRequest.id == request_id,
            PatientProfileChangeRequest.patient_id == current_user.id,
        )
        .first()
    )
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada")
    if request.status != PatientProfileChangeStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La solicitud ya fue resuelta")

    try:
        resolve_change_request(
            db,
            request=request,
            action=payload.action,
            patient_note=payload.patient_note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    approved = request.status == PatientProfileChangeStatus.approved
    notification_service.create(
        db,
        user_id=request.doctor_profile.user_id,
        notification_type="patient_profile_change_resolved",
        title="Respuesta a tu propuesta de datos del paciente",
        body=(
            f"El paciente {'aprobó' if approved else 'rechazó'} los cambios que propusiste en sus datos."
        ),
        action_url=f"/doctor/patients/{request.patient_id}",
        metadata={
            "action_label": "Ver paciente",
            "change_request_id": request.id,
            "resolution": "approved" if approved else "rejected",
        },
    )
    db.commit()
    db.refresh(request)
    return serialize_change_request(db, request)
