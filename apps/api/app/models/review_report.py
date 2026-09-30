import enum

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, backref

from app.db.base import Base


class ReviewReportStatus(str, enum.Enum):
    pending = "pending"
    resolved = "resolved"
    dismissed = "dismissed"


class ReviewReport(Base):
    __tablename__ = "review_reports"
    __table_args__ = (
        UniqueConstraint("review_id", "reporter_id", name="uq_review_report_reporter"),
    )

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("consultation_reviews.id"), nullable=False, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reason = Column(Text, nullable=True)
    status = Column(
        Enum(ReviewReportStatus),
        nullable=False,
        default=ReviewReportStatus.pending,
        server_default=ReviewReportStatus.pending.value,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    review = relationship(
        "ConsultationReview", backref=backref("reports", cascade="all, delete-orphan")
    )
    reporter = relationship("User", foreign_keys=[reporter_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
