from datetime import datetime

from pydantic import BaseModel

from app.models.consent import ConsentType


class ConsentResponse(BaseModel):
    id: int
    appointment_id: int | None
    consent_type: ConsentType
    version: str
    accepted_at: datetime
    revoked_at: datetime | None


class ConsentRevokeRequest(BaseModel):
    consent_type: ConsentType
    appointment_id: int | None = None
