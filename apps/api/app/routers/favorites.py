from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_db, get_current_user
from app.core.logging import get_logger
from app.models.consultation_review import ConsultationReview
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.favorite import Favorite
from app.models.user import User
from app.schemas.doctor import DoctorCardResponse, DoctorPresenceResponse
from app.schemas.favorite import FavoriteCreate, FavoriteListResponse, FavoriteResponse
from app.services.presence_service import resolve_presence

router = APIRouter(prefix="/favorites", tags=["favorites"])
logger = get_logger(__name__)


def _serialize_doctor_card(db: Session, profile: DoctorProfile) -> DoctorCardResponse:
    rating_avg, rating_count = (
        db.query(func.avg(ConsultationReview.rating), func.count(ConsultationReview.id))
        .filter(ConsultationReview.doctor_id == profile.id)
        .one()
    )
    resolved = resolve_presence(db, profile)
    return DoctorCardResponse(
        id=profile.id,
        user_id=profile.user_id,
        display_name=profile.display_name,
        professional_title=profile.professional_title,
        bio_short=profile.bio_short,
        price_per_min_cents=profile.price_per_min_cents,
        rating_avg=round(float(rating_avg or 0), 2),
        rating_count=int(rating_count or 0),
        is_accepting_consultations=profile.is_accepting_consultations,
        status=profile.status,
        presence=DoctorPresenceResponse(
            status=resolved.status,
            status_message=resolved.status_message,
            last_seen_at=resolved.last_seen_at,
        ),
    )


def _serialize_favorite(db: Session, favorite: Favorite) -> FavoriteResponse:
    response = FavoriteResponse.model_validate(favorite)
    if favorite.doctor:
        response.doctor = _serialize_doctor_card(db, favorite.doctor)
    return response


@router.post("", response_model=FavoriteResponse, status_code=status.HTTP_201_CREATED)
def add_favorite(
    data: FavoriteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == data.doctor_id).first()
    if not doctor or doctor.status != DoctorApprovalStatus.approved:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Médico no encontrado")

    existing = (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id, Favorite.doctor_id == data.doctor_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ya está en favoritos")

    favorite = Favorite(user_id=current_user.id, doctor_id=data.doctor_id)
    db.add(favorite)
    db.commit()
    db.refresh(favorite)

    logger.info(f"Favorite added: user={current_user.id}, doctor={data.doctor_id}")
    return _serialize_favorite(db, favorite)


@router.get("/my", response_model=FavoriteListResponse)
def get_my_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    favorites = (
        db.query(Favorite)
        .options(joinedload(Favorite.doctor))
        .filter(Favorite.user_id == current_user.id)
        .order_by(Favorite.created_at.desc())
        .all()
    )

    result = [_serialize_favorite(db, favorite) for favorite in favorites]
    return FavoriteListResponse(favorites=result, total=len(result))


@router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    favorite = (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id, Favorite.doctor_id == doctor_id)
        .first()
    )
    if not favorite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorito no encontrado")

    db.delete(favorite)
    db.commit()
    logger.info(f"Favorite removed: user={current_user.id}, doctor={doctor_id}")
