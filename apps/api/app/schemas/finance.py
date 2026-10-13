from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class FinancePolicyResponse(BaseModel):
    platform_fee_bps: int
    platform_fee_percent: float
    min_price_cents: int
    max_price_cents: int
    currency: str
    # Mientras no se integre la pasarela real, todo se mueve en créditos de prueba.
    is_mock_money: bool = True


class FinanceOverviewResponse(BaseModel):
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    currency: str
    platform_fee_bps: int
    platform_fee_percent: float
    is_mock_money: bool = True
    # Dinero que se mueve por consultas liquidadas.
    gmv_cents: int = 0
    platform_revenue_cents: int = 0
    doctor_payouts_cents: int = 0
    completed_count: int = 0
    # Movimientos de créditos.
    topups_cents: int = 0
    refunds_cents: int = 0
    withdrawals_paid_cents: int = 0
    withdrawals_processing_cents: int = 0
    withdrawals_failed_cents: int = 0
    # Saldos y custodia (estado actual, no depende del rango de fechas).
    held_cents: int = 0
    user_balances_cents: int = 0
    doctor_balances_cents: int = 0


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

    model_config = ConfigDict(from_attributes=True)


class FinanceMovementListResponse(BaseModel):
    items: list[FinanceMovementItem]
    total: int
    limit: int
    offset: int
    inflow_cents: int = 0
    outflow_cents: int = 0


class CommissionItem(BaseModel):
    appointment_payment_id: int
    appointment_id: int
    released_at: Optional[datetime] = None
    doctor_profile_id: int
    doctor_name: str
    doctor_email: Optional[str] = None
    patient_email: Optional[str] = None
    billable_seconds: int = 0
    gross_cents: int = 0
    fee_cents: int = 0
    net_cents: int = 0


class CommissionListResponse(BaseModel):
    items: list[CommissionItem]
    total: int
    limit: int
    offset: int
    gross_cents: int = 0
    fee_cents: int = 0
    net_cents: int = 0
    platform_fee_percent: float = 0
