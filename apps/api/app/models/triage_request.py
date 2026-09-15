from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class TriageRequest(Base):
    __tablename__ = "triage_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # "triage" = Describir Mi Caso, "guide" = Guía IA de Especialidades
    source = Column(String(20), nullable=False, server_default="triage", default="triage")
    symptoms_text = Column(Text, nullable=True)
    answers_json = Column(JSONB, nullable=True)
    result_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", backref="triage_requests")
