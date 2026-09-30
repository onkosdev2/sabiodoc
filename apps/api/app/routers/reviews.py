"""Reportes de reseñas por parte de los usuarios."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.consultation_review import ConsultationReview
from app.models.user import User
from app.schemas.doctor import ReviewReportCreate, ReviewReportResponse
from app.services import review_service

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post(
    "/{review_id}/report",
    response_model=ReviewReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def report_review(
    review_id: int,
    payload: ReviewReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.query(ConsultationReview).filter(ConsultationReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reseña no encontrada")
    return review_service.report_review(
        db, review=review, reporter=current_user, reason=payload.reason
    )
