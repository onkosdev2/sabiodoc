from datetime import datetime

from pydantic import BaseModel, Field


class PaymentConfigResponse(BaseModel):
    provider: str
    configured: bool = True
    currency: str
    mock_tokens: list[str] | None = None


class SetupIntentResponse(BaseModel):
    provider: str
    client_secret: str
    status: str


class PaymentMethodCreateRequest(BaseModel):
    token: str = Field(..., min_length=3, max_length=255)
    make_default: bool = False


class PaymentMethodResponse(BaseModel):
    id: int
    brand: str | None
    last4: str | None
    exp_month: int | None
    exp_year: int | None
    is_default: bool
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
