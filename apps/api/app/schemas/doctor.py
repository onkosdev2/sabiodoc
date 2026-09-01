from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.doctor_presence import DoctorPresenceStatus
from app.models.doctor_profile import DoctorApprovalStatus
from app.models.appointment import AppointmentStatus
from app.models.consultation import ConsultationStatus
from app.schemas.consultation import ConsultationStructuredIntake


class DoctorPresenceUpdate(BaseModel):
    status: DoctorPresenceStatus
    status_message: Optional[str] = Field(default=None, max_length=255)


class DoctorProfileUpsertRequest(BaseModel):
    display_name: str = Field(..., min_length=3, max_length=255)
    professional_title: str = Field(..., min_length=2, max_length=255)
    bio_short: Optional[str] = Field(default=None, max_length=500)
    price_per_min_cents: int = Field(..., ge=1)
    license_number: str = Field(..., min_length=4, max_length=120)
    license_country: str = Field(..., min_length=2, max_length=120)
    country: str = Field(..., min_length=2, max_length=120)
    city: str = Field(..., min_length=2, max_length=120)
    timezone: str = Field(..., min_length=2, max_length=120)
    government_id: str = Field(..., min_length=4, max_length=120)
    years_experience: int = Field(..., ge=0, le=80)
    specialty_ids: list[int] = Field(..., min_length=1)


class DoctorPresenceResponse(BaseModel):
    status: DoctorPresenceStatus
    status_message: Optional[str] = None
    last_seen_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DoctorCardResponse(BaseModel):
    id: int
    user_id: int
    display_name: str
    professional_title: Optional[str] = None
    bio_short: Optional[str] = None
    price_per_min_cents: int
    rating_avg: Decimal
    rating_count: int
    is_accepting_consultations: bool
    status: DoctorApprovalStatus
    presence: DoctorPresenceResponse

    model_config = ConfigDict(from_attributes=True)


class DoctorListResponse(BaseModel):
    doctors: list[DoctorCardResponse]
    total: int


class DoctorSpecialtySummary(BaseModel):
    id: int
    slug: str
    name: str


class DoctorApplicationResponse(BaseModel):
    doctor_id: int
    user_id: int
    email: str
    display_name: str
    professional_title: str | None = None
    bio_short: Optional[str] = None
    price_per_min_cents: int
    license_number: str | None = None
    license_country: str | None = None
    country: str | None = None
    city: str | None = None
    timezone: str | None = None
    government_id: str | None = None
    years_experience: int | None = None
    is_accepting_consultations: bool
    status: DoctorApprovalStatus
    review_notes: str | None = None
    specialties: list[DoctorSpecialtySummary]
    created_at: datetime
    updated_at: datetime


class DoctorApplicationListResponse(BaseModel):
    applications: list[DoctorApplicationResponse]
    total: int


class DoctorApplicationStatusUpdate(BaseModel):
    status: DoctorApprovalStatus
    review_notes: str | None = Field(default=None, max_length=2000)


class DoctorPatientTimelineItemResponse(BaseModel):
    item_type: str
    sort_at: datetime
    specialty_id: int
    specialty_name: str
    consultation_id: int | None = None
    appointment_id: int | None = None
    consultation_status: ConsultationStatus | None = None
    appointment_status: AppointmentStatus | None = None
    summary: str | None = None
    intake: ConsultationStructuredIntake | None = None
    patient_note: str | None = None
    doctor_note: str | None = None
    followup_instructions: str | None = None
    review_rating: int | None = None
    review_comment: str | None = None
    scheduled_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class DoctorPatientTimelineResponse(BaseModel):
    patient_id: int
    patient_email: str
    doctor_id: int
    can_view_history: bool
    items: list[DoctorPatientTimelineItemResponse]
    total: int
