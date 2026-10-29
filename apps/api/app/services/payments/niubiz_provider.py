"""Adaptador Niubiz (scaffolding).

La cuenta y las credenciales todavía no están disponibles. Este adaptador deja
el contrato listo para conectar la pasarela real sin cambiar el flujo de negocio.
No se inventan endpoints ni se procesan datos de tarjeta.
"""

from typing import Any

from app.core.config import settings
from app.services.payments.base import PaymentProvider, ProviderPaymentMethod, ProviderPaymentResult


class NiubizNotConfiguredError(RuntimeError):
    pass


class NiubizPaymentProvider(PaymentProvider):
    name = "niubiz"

    def __init__(self) -> None:
        self.merchant_id = settings.NIUBIZ_MERCHANT_ID
        self.api_user = settings.NIUBIZ_API_USER
        self.api_password = settings.NIUBIZ_API_PASSWORD
        self.security_key = settings.NIUBIZ_SECURITY_KEY
        self.public_key = settings.NIUBIZ_PUBLIC_KEY
        self.base_url = settings.NIUBIZ_BASE_URL
        self.webhook_secret = settings.NIUBIZ_WEBHOOK_SECRET

    @property
    def is_configured(self) -> bool:
        return bool(
            self.merchant_id
            and self.api_user
            and self.api_password
            and self.security_key
        )

    def _ensure_configured(self) -> None:
        if not self.is_configured:
            raise NiubizNotConfiguredError(
                "Niubiz no está configurado. Faltan NIUBIZ_MERCHANT_ID, "
                "NIUBIZ_API_USER, NIUBIZ_API_PASSWORD o NIUBIZ_SECURITY_KEY."
            )

    def create_customer(self, *, user_id: int, email: str) -> str:
        self._ensure_configured()
        raise NotImplementedError("Pendiente: crear cliente/tokenización Niubiz")

    def create_setup_intent(self, *, customer_id: str) -> dict[str, Any]:
        self._ensure_configured()
        raise NotImplementedError("Pendiente: sesión de tokenización Niubiz")

    def attach_payment_method(self, *, customer_id: str, token: str) -> ProviderPaymentMethod:
        self._ensure_configured()
        raise NotImplementedError("Pendiente: alta de tarjeta Niubiz")

    def list_payment_methods(self, *, customer_id: str) -> list[ProviderPaymentMethod]:
        self._ensure_configured()
        raise NotImplementedError("Pendiente: listado de tarjetas Niubiz")

    def set_default_payment_method(self, *, customer_id: str, provider_method_id: str) -> None:
        self._ensure_configured()
        raise NotImplementedError("Pendiente: tarjeta predeterminada Niubiz")

    def remove_payment_method(self, *, provider_method_id: str) -> None:
        self._ensure_configured()
        raise NotImplementedError("Pendiente: baja de tarjeta Niubiz")

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
        self._ensure_configured()
        raise NotImplementedError("Pendiente: cobro off-session Niubiz")

    def confirm_payment(self, *, reference: str) -> ProviderPaymentResult:
        self._ensure_configured()
        raise NotImplementedError("Pendiente: confirmación 3DS Niubiz")

    def refund_payment(self, *, reference: str, amount_cents: int | None = None) -> ProviderPaymentResult:
        self._ensure_configured()
        raise NotImplementedError("Pendiente: reembolso Niubiz")

    def create_payout(
        self,
        *,
        doctor_id: int,
        amount_cents: int,
        currency: str,
        idempotency_key: str,
    ) -> ProviderPaymentResult:
        self._ensure_configured()
        raise NotImplementedError("Pendiente: payout Niubiz")

    def verify_webhook(self, *, headers: dict[str, str], body: bytes) -> dict[str, Any] | None:
        self._ensure_configured()
        raise NotImplementedError("Pendiente: webhook Niubiz")
