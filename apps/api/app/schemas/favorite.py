from pydantic import BaseModel, ConfigDict
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
    
    model_config = ConfigDict(from_attributes=True)


class FavoriteListResponse(BaseModel):
    favorites: list[FavoriteResponse]
    total: int
