from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.doctor_profile import DoctorApprovalStatus
from app.models.user import UserRole


class SupportCounterpart(BaseModel):
    user_id: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None  # "doctor" | "patient"


class SupportDoctorProfile(BaseModel):
    doctor_id: int
    display_name: str
    professional_title: Optional[str] = None
    price_per_min_cents: int = 0
    status: DoctorApprovalStatus
    rating_avg: float = 0
    rating_count: int = 0
    is_accepting_consultations: bool = True
    specialties: list[str] = []


class SupportUserSummary(BaseModel):
    id: int
    email: str
    roles: list[UserRole] = []
    primary_role: UserRole
    doctor_status: Optional[DoctorApprovalStatus] = None
    is_email_verified: bool = True
    created_at: Optional[datetime] = None
    session_version: int = 1


class SupportStats(BaseModel):
    appointments_total: int = 0
    appointments_completed: int = 0
    appointments_no_show: int = 0
    video_sessions_total: int = 0
    consultations_total: int = 0
    unread_notifications: int = 0
    errors_total: int = 0


class SupportAppointmentItem(BaseModel):
    id: int
    specialty_name: str
    status: str
    scheduled_at: datetime
    duration_minutes: int
    counterpart: SupportCounterpart
    payment_amount_cents: Optional[int] = None
    payment_status: Optional[str] = None
    payment_doctor_amount_cents: Optional[int] = None
    video_session_id: Optional[int] = None
    created_at: Optional[datetime] = None


class SupportVideoSessionItem(BaseModel):
    id: int
    status: str
    provider: str
    room_name: str
    counterpart: SupportCounterpart
    appointment_id: Optional[int] = None
    consultation_id: Optional[int] = None
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    billable_seconds: int = 0
    price_per_min_cents: int = 0
    prepaid_amount_cents: int = 0
    closed_reason: Optional[str] = None


class SupportConsultationItem(BaseModel):
    id: int
    status: str
    specialty_name: str
    created_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    auto_closed: bool = False
    has_summary: bool = False


class SupportWalletTransaction(BaseModel):
    id: int
    type: str
    status: str
    amount_cents: int
    balance_after_cents: int
    description: str
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    created_at: Optional[datetime] = None


class SupportWithdrawal(BaseModel):
    id: int
    amount_cents: int
    status: str
    destination: str
    provider: Optional[str] = None
    provider_reference: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: Optional[datetime] = None


class SupportErrorItem(BaseModel):
    id: int
    created_at: Optional[datetime] = None
    level: str
    source: str
    status_code: Optional[int] = None
    method: Optional[str] = None
    path: Optional[str] = None
    error_type: Optional[str] = None
    message: str
    request_id: Optional[str] = None
    video_session_id: Optional[int] = None


class SupportNotificationItem(BaseModel):
    id: int
    type: str
    title: str
    body: str
    action_url: Optional[str] = None
    created_at: Optional[datetime] = None


class SupportUserDetailResponse(BaseModel):
    user: SupportUserSummary
    doctor_profile: Optional[SupportDoctorProfile] = None
    active_session: Optional[SupportVideoSessionItem] = None
    next_appointment: Optional[SupportAppointmentItem] = None
    stats: SupportStats
    appointments: list[SupportAppointmentItem] = []
    video_sessions: list[SupportVideoSessionItem] = []
    consultations: list[SupportConsultationItem] = []
    wallet_balance_cents: int = 0
    transactions: list[SupportWalletTransaction] = []
    withdrawals: list[SupportWithdrawal] = []
    errors: list[SupportErrorItem] = []
    notifications: list[SupportNotificationItem] = []
