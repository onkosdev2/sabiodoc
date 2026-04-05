from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.user import UserRole
from app.models.doctor_profile import DoctorApprovalStatus


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class DoctorRegistrationCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    professional_title: str
    bio_short: Optional[str] = None
    price_per_min_cents: int
    license_number: str
    license_country: str
    country: str
    city: str
    timezone: str
    government_id: str
    years_experience: int
    specialty_ids: list[int]


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: UserRole
    doctor_status: Optional[DoctorApprovalStatus] = None
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
