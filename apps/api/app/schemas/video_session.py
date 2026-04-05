from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.video_session import PaymentStatus, VideoProvider, VideoSessionStatus


class VideoSessionPrepareRequest(BaseModel):
    doctor_id: int
    estimated_minutes: int = Field(..., ge=1, le=180)
    payment_method_id: Optional[str] = Field(default=None, max_length=255)


class VideoSessionPrepareResponse(BaseModel):
    video_session_id: int
    status: VideoSessionStatus
    provider: VideoProvider
    payment_status: PaymentStatus
    room_name: str
    room_url: Optional[str] = None
    patient_token: str
    doctor_token: str
    doctor_price_per_min_cents: int
    estimated_minutes: int
    prepaid_amount_cents: int
    expires_at: datetime
    payment_reference: Optional[str] = None


class DoctorVideoSessionResponse(BaseModel):
    video_session_id: int
    consultation_id: int | None = None
    appointment_id: int | None = None
    patient_id: int
    status: VideoSessionStatus
    provider: VideoProvider
    room_name: str
    room_url: Optional[str] = None
    doctor_token: str
    doctor_price_per_min_cents: int
    estimated_minutes: int
    prepaid_amount_cents: int
    expires_at: datetime
    created_at: datetime
    patient_email: str
    specialty_name: str


class DoctorVideoSessionListResponse(BaseModel):
    sessions: list[DoctorVideoSessionResponse]
    total: int


class AppointmentVideoSessionResponse(BaseModel):
    video_session_id: int
    appointment_id: int
    consultation_id: int | None = None
    status: VideoSessionStatus
    provider: VideoProvider
    room_name: str
    room_url: Optional[str] = None
    participant_token: str
    participant_role: str
    specialty_name: str
    doctor_name: str
    expires_at: datetime


class VideoSessionStatusResponse(BaseModel):
    video_session_id: int
    consultation_id: int | None = None
    appointment_id: int | None = None
    patient_id: int
    patient_email: str
    status: VideoSessionStatus
    provider: VideoProvider
    participant_role: str
    room_name: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    joined_patient_at: datetime | None = None
    joined_doctor_at: datetime | None = None
    expires_at: datetime
    estimated_minutes: int
    elapsed_seconds: int
    remaining_seconds: int
    is_overtime: bool
    doctor_note: str | None = None
    followup_instructions: str | None = None
    closed_reason: str | None = None


class VideoSessionDoctorNoteRequest(BaseModel):
    doctor_note: str | None = Field(default=None, max_length=4000)


class VideoSessionCompleteRequest(BaseModel):
    doctor_note: str | None = Field(default=None, max_length=4000)
    followup_instructions: str | None = Field(default=None, max_length=4000)
    closed_reason: str | None = Field(default=None, max_length=120)
