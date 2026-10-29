from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class FinancePolicyResponse(BaseModel):
    platform_fee_bps: int
    platform_fee_percent: float
    min_price_cents: int
    max_price_cents: int
    currency: str


class FinanceOverviewResponse(BaseModel):
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    currency: str
    platform_fee_bps: int
    platform_fee_percent: float
    # Cobros confirmados.
    gmv_cents: int = 0
    platform_revenue_cents: int = 0
    doctor_net_cents: int = 0
    paid_consultations: int = 0
    # Cobros pendientes e ingresos aún no retirados.
    pending_charges_cents: int = 0
    pending_earnings_cents: int = 0
    # Payouts.
    payouts_paid_cents: int = 0
    payouts_processing_cents: int = 0
    payouts_failed_cents: int = 0


class FinanceMovementItem(BaseModel):
    id: int
    created_at: Optional[datetime] = None
    type: str
    direction: str  # "in" | "out"
    amount_cents: int
    status: str
    description: str
    actor_email: Optional[str] = None
    actor_role: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    provider: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FinanceMovementListResponse(BaseModel):
    items: list[FinanceMovementItem]
    total: int
    limit: int
    offset: int
    inflow_cents: int = 0
    outflow_cents: int = 0


class CommissionItem(BaseModel):
    charge_id: int
    appointment_id: int
    released_at: Optional[datetime] = None
    doctor_profile_id: int
    doctor_name: str
    doctor_email: Optional[str] = None
    patient_email: Optional[str] = None
    paid_minutes: int = 0
    gross_cents: int = 0
    fee_cents: int = 0
    net_cents: int = 0
    status: str


class CommissionListResponse(BaseModel):
    items: list[CommissionItem]
    total: int
    limit: int
    offset: int
    gross_cents: int = 0
    fee_cents: int = 0
    net_cents: int = 0
    platform_fee_percent: float = 0
