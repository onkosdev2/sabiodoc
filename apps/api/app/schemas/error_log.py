from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class ClientErrorReport(BaseModel):
    """Reporte que envía el navegador cuando una acción falla en el cliente.

    No incluir datos sensibles: el backend los sanitiza igualmente.
    """

    message: str = Field(..., min_length=1, max_length=4000)
    error_type: Optional[str] = Field(default=None, max_length=200)
    stack: Optional[str] = Field(default=None, max_length=20000)
    level: str = Field(default="error", max_length=20)
    video_session_id: Optional[int] = None
    appointment_id: Optional[int] = None
    consultation_id: Optional[int] = None
    context: Optional[dict[str, Any]] = None


class ClientErrorReportResponse(BaseModel):
    status: str = "recorded"
    request_id: Optional[str] = None


class ErrorLogSummary(BaseModel):
    total: int
    last_24h: int
    video_total: int
    client_total: int
    backend_total: int


class ErrorLogItem(BaseModel):
    id: int
    created_at: Optional[datetime] = None
    level: str
    source: str
    status_code: Optional[int] = None
    method: Optional[str] = None
    path: Optional[str] = None
    error_type: Optional[str] = None
    message: str
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    request_id: Optional[str] = None
    video_session_id: Optional[int] = None
    appointment_id: Optional[int] = None
    consultation_id: Optional[int] = None
    fingerprint: Optional[str] = None
    occurrences: int = 1

    model_config = ConfigDict(from_attributes=True)


class ErrorLogDetail(ErrorLogItem):
    stack_trace: Optional[str] = None
    context: Optional[dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class ErrorLogListResponse(BaseModel):
    items: list[ErrorLogItem]
    total: int
    limit: int
    offset: int
    summary: ErrorLogSummary


class ErrorLogBulkDeleteRequest(BaseModel):
    ids: list[int] = Field(..., min_length=1, max_length=500)


class ErrorLogDeleteResponse(BaseModel):
    deleted: int


class ErrorLogCleanupResponse(BaseModel):
    deleted: int
    retention_days: int
