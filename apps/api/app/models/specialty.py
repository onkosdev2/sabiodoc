from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class Specialty(Base):
    __tablename__ = "specialties"
    
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    keywords = Column(JSONB, default=list)
    is_top = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
