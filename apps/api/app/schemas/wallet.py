from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.wallet import (
    AppointmentPaymentStatus,
    WalletTransactionStatus,
    WalletTransactionType,
    WithdrawalStatus,
)


class WalletTransactionResponse(BaseModel):
    id: int
    type: WalletTransactionType
    status: WalletTransactionStatus
    amount_cents: int
    balance_after_cents: int
    description: str
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WalletResponse(BaseModel):
    # Saldo en centavos y su equivalente en créditos (1 crédito = 1 USD).
    balance_cents: int
    credits: float
    currency: str
    min_topup_cents: int
    min_withdrawal_cents: int
    transactions: list[WalletTransactionResponse] = []


class WalletTransactionsResponse(BaseModel):
    transactions: list[WalletTransactionResponse]
    total: int


class WalletTopupRequest(BaseModel):
    amount_cents: int = Field(..., ge=1, description="Monto a recargar en centavos")


class WalletWithdrawRequest(BaseModel):
    amount_cents: int = Field(..., ge=1, description="Monto a retirar en centavos")
    destination: str = Field(..., min_length=3, max_length=255, description="Cuenta destino del retiro")


class WithdrawalResponse(BaseModel):
    id: int
    user_id: int
    user_email: Optional[str] = None
    amount_cents: int
    status: WithdrawalStatus
    destination: str
    admin_notes: Optional[str] = None
    requested_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class WithdrawalListResponse(BaseModel):
    withdrawals: list[WithdrawalResponse]
    total: int


class WithdrawalProcessRequest(BaseModel):
    approve: bool
    notes: Optional[str] = Field(default=None, max_length=1000)


class AppointmentPaymentResponse(BaseModel):
    amount_cents: int
    doctor_amount_cents: int
    platform_fee_cents: int
    status: AppointmentPaymentStatus

    model_config = ConfigDict(from_attributes=True)
