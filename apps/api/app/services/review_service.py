"""Reseñas: verificación, reportes y moderación."""

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.consultation_review import ConsultationReview
from app.models.doctor_profile import DoctorProfile
from app.models.review_report import ReviewReport, ReviewReportStatus
from app.models.user import User


def recompute_doctor_rating(db: Session, doctor_id: int) -> tuple[float, int]:
    """Recalcula promedio y cantidad desde las reseñas visibles (no ocultas)."""
    db.flush()
    average, count = (
        db.query(func.avg(ConsultationReview.rating), func.count(ConsultationReview.id))
        .filter(
            ConsultationReview.doctor_id == doctor_id,
            ConsultationReview.is_hidden.is_(False),
        )
        .one()
    )
    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_id).first()
    if doctor_profile is not None:
        doctor_profile.rating_avg = round(float(average or 0), 2)
        doctor_profile.rating_count = int(count or 0)
    return round(float(average or 0), 2), int(count or 0)


def visible_reviews_query(db: Session, doctor_id: int):
    return (
        db.query(ConsultationReview)
        .filter(
            ConsultationReview.doctor_id == doctor_id,
            ConsultationReview.is_hidden.is_(False),
        )
        .order_by(ConsultationReview.created_at.desc())
    )


def report_review(
    db: Session,
    *,
    review: ConsultationReview,
    reporter: User,
    reason: str | None,
) -> ReviewReport:
    if review.patient_id == reporter.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes reportar tu propia reseña",
        )
    existing = (
        db.query(ReviewReport)
        .filter(
            ReviewReport.review_id == review.id,
            ReviewReport.reporter_id == reporter.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya reportaste esta reseña",
        )

    report = ReviewReport(review_id=review.id, reporter_id=reporter.id, reason=reason)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def hide_review(
    db: Session,
    *,
    review: ConsultationReview,
    moderator: User,
    reason: str | None,
) -> ConsultationReview:
    review.is_hidden = True
    review.hidden_reason = reason
    review.hidden_at = datetime.now(UTC)
    review.hidden_by_id = moderator.id

    # Los reportes pendientes de esta reseña quedan resueltos al ocultarla.
    now = datetime.now(UTC)
    pending_reports = (
        db.query(ReviewReport)
        .filter(
            ReviewReport.review_id == review.id,
            ReviewReport.status == ReviewReportStatus.pending,
        )
        .all()
    )
    for report in pending_reports:
        report.status = ReviewReportStatus.resolved
        report.resolved_at = now
        report.resolved_by_id = moderator.id

    recompute_doctor_rating(db, review.doctor_id)
    db.commit()
    db.refresh(review)
    return review


def unhide_review(db: Session, *, review: ConsultationReview) -> ConsultationReview:
    review.is_hidden = False
    review.hidden_reason = None
    review.hidden_at = None
    review.hidden_by_id = None
    recompute_doctor_rating(db, review.doctor_id)
    db.commit()
    db.refresh(review)
    return review


def resolve_report(
    db: Session,
    *,
    report: ReviewReport,
    moderator: User,
    new_status: ReviewReportStatus,
) -> ReviewReport:
    report.status = new_status
    report.resolved_at = datetime.now(UTC)
    report.resolved_by_id = moderator.id
    db.commit()
    db.refresh(report)
    return report
