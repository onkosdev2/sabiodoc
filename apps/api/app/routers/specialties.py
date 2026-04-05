from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.deps import get_db
from app.models.specialty import Specialty
from app.schemas.specialty import SpecialtyResponse, SpecialtyListResponse
from app.services.search_service import search_service
from app.core.logging import get_logger

router = APIRouter(prefix="/specialties", tags=["specialties"])
logger = get_logger(__name__)


@router.get("", response_model=SpecialtyListResponse)
def list_specialties(
    query: Optional[str] = Query(None, min_length=2, description="Término de búsqueda"),
    db: Session = Depends(get_db)
):
    if query:
        results = search_service.search_specialties(db, query)
        specialties = [s for s, _ in results]
        logger.info(f"Search for '{query}' returned {len(specialties)} results")
    else:
        specialties = db.query(Specialty).order_by(Specialty.name).all()
    
    return SpecialtyListResponse(
        specialties=[SpecialtyResponse.model_validate(s) for s in specialties],
        total=len(specialties)
    )


@router.get("/top", response_model=SpecialtyListResponse)
def get_top_specialties(db: Session = Depends(get_db)):
    specialties = db.query(Specialty).filter(Specialty.is_top == True).order_by(Specialty.name).all()
    
    return SpecialtyListResponse(
        specialties=[SpecialtyResponse.model_validate(s) for s in specialties],
        total=len(specialties)
    )


@router.get("/{slug}", response_model=SpecialtyResponse)
def get_specialty_by_slug(slug: str, db: Session = Depends(get_db)):
    specialty = db.query(Specialty).filter(Specialty.slug == slug).first()
    
    if not specialty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Especialidad no encontrada"
        )
    
    return SpecialtyResponse.model_validate(specialty)
