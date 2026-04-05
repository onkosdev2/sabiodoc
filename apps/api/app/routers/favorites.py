from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.specialty import Specialty
from app.models.favorite import Favorite
from app.schemas.favorite import FavoriteCreate, FavoriteResponse, FavoriteListResponse
from app.schemas.specialty import SpecialtyResponse
from app.core.logging import get_logger

router = APIRouter(prefix="/favorites", tags=["favorites"])
logger = get_logger(__name__)


@router.post("", response_model=FavoriteResponse, status_code=status.HTTP_201_CREATED)
def toggle_favorite(
    data: FavoriteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    specialty = db.query(Specialty).filter(Specialty.id == data.specialty_id).first()
    if not specialty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Especialidad no encontrada"
        )
    
    existing = (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id, Favorite.specialty_id == data.specialty_id)
        .first()
    )
    
    if data.action == "remove":
        if existing:
            db.delete(existing)
            db.commit()
            logger.info(f"Favorite removed: user={current_user.id}, specialty={data.specialty_id}")
        raise HTTPException(
            status_code=status.HTTP_200_OK,
            detail="Favorito eliminado"
        )
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya está en favoritos"
        )
    
    favorite = Favorite(
        user_id=current_user.id,
        specialty_id=data.specialty_id
    )
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    
    logger.info(f"Favorite added: user={current_user.id}, specialty={data.specialty_id}")
    
    response = FavoriteResponse.model_validate(favorite)
    response.specialty = SpecialtyResponse.model_validate(specialty)
    
    return response


@router.get("/my", response_model=FavoriteListResponse)
def get_my_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    favorites = (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id)
        .order_by(Favorite.created_at.desc())
        .all()
    )
    
    result = []
    for f in favorites:
        response = FavoriteResponse.model_validate(f)
        if f.specialty:
            response.specialty = SpecialtyResponse.model_validate(f.specialty)
        result.append(response)
    
    return FavoriteListResponse(
        favorites=result,
        total=len(result)
    )


@router.delete("/{specialty_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    specialty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    favorite = (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id, Favorite.specialty_id == specialty_id)
        .first()
    )
    
    if not favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Favorito no encontrado"
        )
    
    db.delete(favorite)
    db.commit()
    logger.info(f"Favorite removed: user={current_user.id}, specialty={specialty_id}")
