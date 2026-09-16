from pydantic import BaseModel, ConfigDict, EmailStr, Field
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
    is_reviewer: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReviewerCreate(BaseModel):
    email: EmailStr
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)


class ReviewerResponse(BaseModel):
    id: int
    email: str
    role: UserRole
    is_reviewer: bool = True
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReviewerListResponse(BaseModel):
    reviewers: list[ReviewerResponse]
    total: int


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole = UserRole.patient
    is_reviewer: bool = False


class AdminUserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    role: Optional[UserRole] = None
    is_reviewer: Optional[bool] = None


class AdminUserResponse(BaseModel):
    id: int
    email: str
    role: UserRole
    doctor_status: Optional[DoctorApprovalStatus] = None
    is_reviewer: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminUserListResponse(BaseModel):
    users: list[AdminUserResponse]
    total: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
