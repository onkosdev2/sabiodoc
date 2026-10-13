"""Pasarela de payouts (retiros).

Abstrae el proveedor que mueve el dinero real hacia la cuenta del usuario. En
pruebas se usa ``mock`` (no mueve dinero, resuelve al instante); en producción
se usa ``stripe`` (Stripe Connect / Transfers), que devuelve un payout en
estado ``pending`` y confirma por webhook.

El flujo del negocio es siempre el mismo, con o sin aprobación manual:
1. Se crea el retiro en estado ``processing`` y se debita el monedero.
2. Se pide al proveedor que envíe el dinero.
3. ``paid`` confirma el envío; ``failed`` devuelve los créditos al usuario.
"""

import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class PayoutResult:
    # "paid" si el proveedor confirmó el envío; "processing" si queda pendiente.
    status: str
    reference: str | None = None
    provider: str = "mock"


class PayoutProvider:
    name = "base"

    def create_payout(self, withdrawal) -> PayoutResult:  # pragma: no cover - interfaz
        raise NotImplementedError

    def verify_webhook(self, payload: bytes, headers: dict[str, str]) -> dict | None:
        return None


class MockPayoutProvider(PayoutProvider):
    """Proveedor de pruebas: resuelve el retiro al instante, sin mover dinero."""

    name = "mock"

    def create_payout(self, withdrawal) -> PayoutResult:
        reference = f"mock_payout_{secrets.token_hex(10)}"
        logger.warning(
            f"[mock] Payout simulado para withdrawal #{withdrawal.id} "
            f"({withdrawal.amount_cents} centavos): {reference}"
        )
        return PayoutResult(status="paid", reference=reference, provider=self.name)


class StripePayoutProvider(PayoutProvider):
    """Stripe Connect (Transfers) hacia la cuenta conectada del usuario.

    ``withdrawal.destination`` debe ser el ID de la cuenta conectada (``acct_...``).
    El resultado queda en ``processing`` hasta que Stripe confirma por webhook.
    """

    name = "stripe"

    def __init__(self) -> None:
        self.secret_key = settings.STRIPE_SECRET_KEY
        self.webhook_secret = settings.STRIPE_WEBHOOK_SECRET
        self.currency = settings.STRIPE_CURRENCY

    def create_payout(self, withdrawal) -> PayoutResult:
        if not self.secret_key:
            raise RuntimeError("STRIPE_SECRET_KEY no está configurado para payouts")

        payload = {
            "amount": str(withdrawal.amount_cents),
            "currency": self.currency,
            "destination": withdrawal.destination,
            "metadata[withdrawal_id]": str(withdrawal.id),
            "metadata[user_id]": str(withdrawal.user_id),
        }
        headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/x-www-form-urlencoded",
            # Evita transferencias duplicadas si se reintenta la petición.
            "Idempotency-Key": f"withdrawal-{withdrawal.id}",
        }
        with httpx.Client(timeout=20.0) as client:
            response = client.post(
                "https://api.stripe.com/v1/transfers", headers=headers, data=payload
            )
            response.raise_for_status()
            transfer = response.json()

        return PayoutResult(
            status="processing",
            reference=transfer.get("id"),
            provider=self.name,
        )

    def verify_webhook(self, payload: bytes, headers: dict[str, str]) -> dict | None:
        if not self.webhook_secret:
            return None
        signature_header = headers.get("stripe-signature") or headers.get("Stripe-Signature")
        if not signature_header:
            return None

        timestamp: str | None = None
        signatures: list[str] = []
        for part in signature_header.split(","):
            key, _, value = part.partition("=")
            if key == "t":
                timestamp = value
            elif key == "v1":
                signatures.append(value)
        if not timestamp or not signatures:
            return None
        # Tolerancia de 5 minutos contra reenvíos.
        try:
            if abs(time.time() - int(timestamp)) > 300:
                return None
        except ValueError:
            return None

        signed = f"{timestamp}.{payload.decode('utf-8')}".encode("utf-8")
        expected = hmac.new(
            self.webhook_secret.encode("utf-8"), signed, hashlib.sha256
        ).hexdigest()
        if not any(hmac.compare_digest(expected, candidate) for candidate in signatures):
            return None

        import json

        try:
            return json.loads(payload.decode("utf-8"))
        except ValueError:
            return None


class PayoutService:
    def __init__(self) -> None:
        self.provider = self._build_provider()
        logger.info(f"Payout provider: {self.provider.name}")

    @staticmethod
    def _build_provider() -> PayoutProvider:
        name = (settings.PAYOUT_PROVIDER or "mock").strip().lower()
        if name == "stripe":
            return StripePayoutProvider()
        return MockPayoutProvider()

    @property
    def provider_name(self) -> str:
        return self.provider.name

    @property
    def is_mock(self) -> bool:
        return self.provider.name == "mock"

    def create_payout(self, withdrawal) -> PayoutResult:
        return self.provider.create_payout(withdrawal)

    def verify_webhook(self, payload: bytes, headers: dict[str, str]) -> dict | None:
        return self.provider.verify_webhook(payload, headers)


payout_service = PayoutService()
