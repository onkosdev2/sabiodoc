from datetime import datetime

from pydantic import BaseModel, Field


class EarningsSummary(BaseModel):
    pending_cents: int
    available_cents: int
    paid_cents: int
    currency: str


class EarningItem(BaseModel):
    id: int
    appointment_id: int
    gross_cents: int
    platform_fee_cents: int
    net_cents: int
    status: str
    available_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PayoutItem(BaseModel):
    id: int
    amount_cents: int
    currency: str
    provider: str
    provider_reference: str | None
    status: str
    failure_reason: str | None
    requested_at: datetime
    processed_at: datetime | None

    model_config = {"from_attributes": True}


class PayoutRequest(BaseModel):
    amount_cents: int | None = Field(default=None, ge=1)


class ReconciliationResponse(BaseModel):
    ok: bool
    checked_charges: int
    missing_earnings: list[int]
    amount_mismatches: list[dict]
    missing_transactions: list[int]
