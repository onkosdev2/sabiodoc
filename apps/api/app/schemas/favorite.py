from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.doctor import DoctorCardResponse


class FavoriteCreate(BaseModel):
    doctor_id: int


class FavoriteResponse(BaseModel):
    id: int
    doctor_id: int
    created_at: datetime
    doctor: Optional[DoctorCardResponse] = None

    model_config = ConfigDict(from_attributes=True)


class FavoriteListResponse(BaseModel):
    favorites: list[FavoriteResponse]
    total: int
