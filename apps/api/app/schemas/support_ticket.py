from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.support_ticket import (
    SupportTicketAuthorRole,
    SupportTicketCategory,
    SupportTicketPriority,
    SupportTicketStatus,
)


class SupportAttachmentResponse(BaseModel):
    id: int
    original_name: str
    content_type: Optional[str] = None
    bytes: int = 0
    url: str
    secure_url: str

    model_config = ConfigDict(from_attributes=True)


class SupportTicketContext(BaseModel):
    """Contexto que envía el cliente al crear el ticket (opcional)."""

    url: Optional[str] = Field(default=None, max_length=500)
    user_agent: Optional[str] = Field(default=None, max_length=500)
    appointment_id: Optional[int] = None
    video_session_id: Optional[int] = None


class SupportTicketCreate(BaseModel):
    subject: str = Field(..., min_length=3, max_length=255)
    category: SupportTicketCategory = SupportTicketCategory.other
    message: str = Field(..., min_length=10, max_length=5000)
    attachment_ids: list[int] = Field(default_factory=list, max_length=5)
    context: Optional[SupportTicketContext] = None


class SupportTicketReply(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    attachment_ids: list[int] = Field(default_factory=list, max_length=5)


class SupportTicketMessageResponse(BaseModel):
    id: int
    author_role: SupportTicketAuthorRole
    author_user_id: Optional[int] = None
    author_name: Optional[str] = None
    body: str
    attachments: list[SupportAttachmentResponse] = []
    created_at: Optional[datetime] = None


class SupportTicketResponse(BaseModel):
    id: int
    reference: Optional[str] = None
    subject: str
    category: SupportTicketCategory
    status: SupportTicketStatus
    priority: SupportTicketPriority
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    message_count: int = 0
    last_message_preview: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None


class SupportTicketDetailResponse(SupportTicketResponse):
    messages: list[SupportTicketMessageResponse] = []
    context: Optional[dict] = None
    related_appointment_id: Optional[int] = None
    related_video_session_id: Optional[int] = None
    assigned_to_user_id: Optional[int] = None
    assigned_to_email: Optional[str] = None


class SupportTicketListResponse(BaseModel):
    tickets: list[SupportTicketResponse]
    total: int
    open_count: int = 0


class SupportTicketUpdateRequest(BaseModel):
    status: Optional[SupportTicketStatus] = None
    priority: Optional[SupportTicketPriority] = None
    assigned_to_user_id: Optional[int] = None
