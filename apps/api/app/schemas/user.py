from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional
from datetime import datetime
from app.models.user import UserRole
from app.models.doctor_profile import DoctorApprovalStatus


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class DoctorRegistrationCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str
    professional_title: str
    bio_short: Optional[str] = None
    price_per_min_cents: int
    license_number: str
    license_country: str
    specialist_registry_number: Optional[str] = Field(default=None, max_length=120)
    country: str
    city: str
    address: Optional[str] = Field(default=None, max_length=255)
    timezone: str
    government_id: str
    years_experience: int
    specialty_ids: list[int]


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=256)
    new_password: str = Field(..., min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=256)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class MessageResponse(BaseModel):
    message: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: UserRole
    doctor_status: Optional[DoctorApprovalStatus] = None
    is_reviewer: bool = False
    is_email_verified: bool = True
    display_name: Optional[str] = None
    doctor_display_name: Optional[str] = None
    patient_display_name: Optional[str] = None
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
    full_name: Optional[str] = None
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


class RegisterResponse(BaseModel):
    """Respuesta de registro.

    Si la verificación de correo está activa, no se emite token: el usuario debe
    confirmar su correo antes de iniciar sesión.
    """

    message: str
    verification_required: bool = False
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserResponse] = None
