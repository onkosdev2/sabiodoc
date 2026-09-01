from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime


class SpecialtyBase(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    keywords: List[str] = []
    is_top: bool = False


class SpecialtyResponse(SpecialtyBase):
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class SpecialtyListResponse(BaseModel):
    specialties: List[SpecialtyResponse]
    total: int
