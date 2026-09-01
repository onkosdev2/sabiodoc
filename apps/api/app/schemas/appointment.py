from datetime import datetime, time
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.appointment import AppointmentStatus
from app.schemas.consultation import ConsultationStructuredIntake


class DoctorAvailabilitySlotInput(BaseModel):
    weekday: int = Field(..., ge=0, le=6)
    start_time: time
    end_time: time
    is_active: bool = True


class DoctorAvailabilitySlotResponse(BaseModel):
    id: int
    weekday: int
    start_time: time
    end_time: time
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class DoctorAvailabilityUpsertRequest(BaseModel):
    timezone: str = Field(..., min_length=2, max_length=120)
    slots: list[DoctorAvailabilitySlotInput]


class DoctorAvailabilityResponse(BaseModel):
    timezone: str
    slots: list[DoctorAvailabilitySlotResponse]


class DoctorBookableSlotResponse(BaseModel):
    starts_at: datetime
    ends_at: datetime
    duration_minutes: int


class DoctorBookableSlotListResponse(BaseModel):
    timezone: str
    slots: list[DoctorBookableSlotResponse]
    total: int


class AppointmentCreateRequest(BaseModel):
    doctor_id: int
    scheduled_at: datetime
    duration_minutes: int = Field(default=30, ge=15, le=120)
    consultation_id: Optional[int] = None
    specialty_id: Optional[int] = None
    patient_note: Optional[str] = Field(default=None, max_length=2000)
    accepted_terms: bool = True
    consent_text_version: str = Field(default="v1", min_length=1, max_length=50)


class AppointmentCancelRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=1000)


class AppointmentRescheduleRequest(BaseModel):
    scheduled_at: datetime
    duration_minutes: int = Field(default=30, ge=15, le=120)
    reason: Optional[str] = Field(default=None, max_length=1000)


class AppointmentNoShowRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=1000)


class AppointmentCompleteRequest(BaseModel):
    doctor_note: Optional[str] = Field(default=None, max_length=4000)
    followup_instructions: Optional[str] = Field(default=None, max_length=4000)


class AppointmentReviewCreateRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=1200)


class AppointmentResponse(BaseModel):
    id: int
    consultation_id: Optional[int] = None
    specialty_id: int
    specialty_name: str
    patient_id: int
    patient_email: str
    doctor_id: int
    doctor_name: str
    status: AppointmentStatus
    scheduled_at: datetime
    duration_minutes: int
    patient_note: Optional[str] = None
    ai_summary_snapshot: Optional[str] = None
    ai_intake_snapshot: Optional[ConsultationStructuredIntake] = None
    doctor_note: Optional[str] = None
    followup_instructions: Optional[str] = None
    cancellation_reason: Optional[str] = None
    booked_via_ai: bool
    consent_text_version: Optional[str] = None
    joined_patient_at: Optional[datetime] = None
    joined_doctor_at: Optional[datetime] = None
    no_show_marked_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    review_rating: Optional[int] = None
    review_comment: Optional[str] = None


class AppointmentListResponse(BaseModel):
    appointments: list[AppointmentResponse]
    total: int


class DoctorDashboardMetricCard(BaseModel):
    key: str
    label: str
    value: str

class AdminLiveVideoSessionResponse(BaseModel):
    video_session_id: int
    appointment_id: Optional[int] = None
    consultation_id: Optional[int] = None
    doctor_name: str
    patient_email: str
    status: str
    started_at: Optional[datetime] = None
    expires_at: datetime
    joined_patient_at: Optional[datetime] = None
    joined_doctor_at: Optional[datetime] = None


class DoctorDashboardResponse(BaseModel):
    metrics: list[DoctorDashboardMetricCard]
    upcoming_appointments: list[AppointmentResponse]
    recent_completed_appointments: list[AppointmentResponse]
    active_video_sessions: list[AdminLiveVideoSessionResponse]
    unread_notifications: int
    average_rating: float


class AdminMarketplaceOverviewResponse(BaseModel):
    doctors_online: int
    doctors_busy: int
    pending_applications: int
    scheduled_appointments: int
    completed_appointments: int
    active_video_sessions: int
    failed_video_sessions: int
    no_show_appointments: int
    unread_notifications: int


class AdminIncidentResponse(BaseModel):
    type: str
    title: str
    created_at: datetime
    action_url: Optional[str] = None
    entity_id: Optional[int] = None


class AdminLiveVideoSessionListResponse(BaseModel):
    sessions: list[AdminLiveVideoSessionResponse]
    total: int


class AdminIncidentListResponse(BaseModel):
    incidents: list[AdminIncidentResponse]
    total: int
