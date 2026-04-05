from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.schemas.specialty import SpecialtyResponse


class FavoriteCreate(BaseModel):
    specialty_id: int
    action: str = "add"


class FavoriteResponse(BaseModel):
    id: int
    specialty_id: Optional[int]
    created_at: datetime
    specialty: Optional[SpecialtyResponse] = None
    
    class Config:
        from_attributes = True


class FavoriteListResponse(BaseModel):
    favorites: list[FavoriteResponse]
    total: int
