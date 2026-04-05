from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class Favorite(Base):
    __tablename__ = "favorites"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    specialty_id = Column(Integer, ForeignKey("specialties.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", backref="favorites")
    specialty = relationship("Specialty", backref="favorites")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'specialty_id', name='uq_user_specialty_favorite'),
    )
