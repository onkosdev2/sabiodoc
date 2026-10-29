from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ProviderPaymentMethod:
    provider_method_id: str
    brand: str | None
    last4: str | None
    exp_month: int | None
    exp_year: int | None


@dataclass(frozen=True)
class ProviderPaymentResult:
    reference: str
    status: str
    failure_code: str | None = None
    failure_message: str | None = None
    next_action: str | None = None


class PaymentProvider(ABC):
    """Contrato que debe cumplir cualquier pasarela real o mock."""

    name: str

    @abstractmethod
    def create_customer(self, *, user_id: int, email: str) -> str:
        """Devuelve el id de cliente en el proveedor."""

    @abstractmethod
    def create_setup_intent(self, *, customer_id: str) -> dict[str, Any]:
        """Devuelve al menos client_secret y status."""

    @abstractmethod
    def attach_payment_method(self, *, customer_id: str, token: str) -> ProviderPaymentMethod:
        """Tokeniza/adjunta una tarjeta y devuelve datos enmascarados."""

    @abstractmethod
    def list_payment_methods(self, *, customer_id: str) -> list[ProviderPaymentMethod]:
        """Lista métodos activos del cliente."""

    @abstractmethod
    def set_default_payment_method(self, *, customer_id: str, provider_method_id: str) -> None:
        """Marca un método como predeterminado en el proveedor."""

    @abstractmethod
    def remove_payment_method(self, *, provider_method_id: str) -> None:
        """Desvincula un método del cliente."""

    @abstractmethod
    def create_payment(
        self,
        *,
        customer_id: str,
        provider_method_id: str,
        amount_cents: int,
        currency: str,
        idempotency_key: str,
        metadata: dict[str, Any] | None = None,
    ) -> ProviderPaymentResult:
        """Crea un cobro off-session."""

    @abstractmethod
    def confirm_payment(self, *, reference: str) -> ProviderPaymentResult:
        """Confirma un cobro que requiere acción (p. ej. 3DS)."""

    @abstractmethod
    def refund_payment(self, *, reference: str, amount_cents: int | None = None) -> ProviderPaymentResult:
        """Reembolsa total o parcialmente un cobro."""

    @abstractmethod
    def create_payout(
        self,
        *,
        doctor_id: int,
        amount_cents: int,
        currency: str,
        idempotency_key: str,
    ) -> ProviderPaymentResult:
        """Envía dinero al médico."""

    @abstractmethod
    def verify_webhook(self, *, headers: dict[str, str], body: bytes) -> dict[str, Any] | None:
        """Valida la firma y devuelve el evento, o None si es inválido."""
