from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import datetime


class SpecialtyBase(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    keywords: List[str] = []
    is_top: bool = False


class SpecialtyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=100, pattern=r"^[a-z0-9-]+$")
    description: Optional[str] = Field(default=None, max_length=4000)
    keywords: List[str] = Field(default_factory=list)
    is_top: bool = False


class SpecialtyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=100, pattern=r"^[a-z0-9-]+$")
    description: Optional[str] = Field(default=None, max_length=4000)
    keywords: Optional[List[str]] = None
    is_top: Optional[bool] = None


class SpecialtyResponse(SpecialtyBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SpecialtyListResponse(BaseModel):
    specialties: List[SpecialtyResponse]
    total: int
