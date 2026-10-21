from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
from app.core.security import validate_password_strength
from app.models.user import UserRole
from app.models.doctor_profile import DoctorApprovalStatus


def _check_password(value: str) -> str:
    return validate_password_strength(value)


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    accepted_terms: bool = True
    consent_text_version: str = Field(default="v1", min_length=1, max_length=50)

    @field_validator("password")
    @classmethod
    def _validate_password(cls, value: str) -> str:
        return _check_password(value)


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

    @field_validator("password")
    @classmethod
    def _validate_password(cls, value: str) -> str:
        return _check_password(value)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=256)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _validate_new_password(cls, value: str) -> str:
        return _check_password(value)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _validate_new_password(cls, value: str) -> str:
        return _check_password(value)


class ChangePasswordResponse(BaseModel):
    message: str
    # Token nuevo: el cambio de contraseña revoca las demás sesiones.
    access_token: str
    token_type: str = "bearer"


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=256)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class MessageResponse(BaseModel):
    message: str


class UserResponse(BaseModel):
    id: int
    email: str
    # ``role`` es el rol primario (para mostrar); ``roles`` es el conjunto real.
    role: UserRole
    roles: list[UserRole] = []
    # País configurado en la cuenta (perfil de paciente o de médico).
    country: Optional[str] = None
    doctor_status: Optional[DoctorApprovalStatus] = None
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
    roles: list[UserRole] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReviewerListResponse(BaseModel):
    reviewers: list[ReviewerResponse]
    total: int


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    roles: list[UserRole] = Field(default_factory=lambda: [UserRole.patient])


class AdminUserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    roles: Optional[list[UserRole]] = None


class AdminUserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    role: UserRole
    roles: list[UserRole] = []
    doctor_status: Optional[DoctorApprovalStatus] = None
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
