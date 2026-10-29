import hashlib
import hmac
import json
import threading
import time
import uuid
from typing import Any

from app.core.config import settings
from app.services.payments.base import PaymentProvider, ProviderPaymentMethod, ProviderPaymentResult

_TOKEN_DATA: dict[str, tuple[str, str, int, int, str]] = {
    # token -> (brand, last4, exp_month, exp_year, scenario)
    "pm_mock_success": ("Visa", "4242", 12, 2030, "success"),
    "pm_mock_declined": ("Visa", "0002", 12, 2030, "declined"),
    "pm_mock_insufficient": ("Mastercard", "9995", 12, 2030, "insufficient"),
    "pm_mock_3ds": ("Visa", "3220", 12, 2030, "3ds"),
    "pm_mock_timeout": ("Visa", "1111", 12, 2030, "timeout"),
    "pm_mock_expired": ("Visa", "4444", 1, 2020, "expired"),
}


class MockPaymentProvider(PaymentProvider):
    """Proveedor de pagos en memoria para desarrollo y tests.

    No procesa datos reales de tarjeta. Los escenarios se eligen con tokens
    (`pm_mock_success`, `pm_mock_declined`, etc.).
    """

    name = "mock"

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._customers: dict[str, dict[str, Any]] = {}
        self._methods: dict[str, dict[str, Any]] = {}
        self._payments: dict[str, dict[str, Any]] = {}
        self._idempotency: dict[str, ProviderPaymentResult] = {}
        self._payouts: dict[str, dict[str, Any]] = {}

    def reset(self) -> None:
        with self._lock:
            self._customers.clear()
            self._methods.clear()
            self._payments.clear()
            self._idempotency.clear()
            self._payouts.clear()

    def _delay(self) -> None:
        if settings.MOCK_PAYMENT_LATENCY_MS > 0:
            time.sleep(settings.MOCK_PAYMENT_LATENCY_MS / 1000)

    def create_customer(self, *, user_id: int, email: str) -> str:
        customer_id = f"mock_cus_{uuid.uuid4().hex[:16]}"
        with self._lock:
            self._customers[customer_id] = {"user_id": user_id, "email": email, "methods": []}
        return customer_id

    def _ensure_customer(self, customer_id: str) -> None:
        if customer_id not in self._customers:
            self._customers[customer_id] = {"user_id": 0, "email": "", "methods": []}

    def _scenario_from_method(self, provider_method_id: str) -> str:
        # Formato nuevo: mock_pm_<scenario>_<uuid>. Formato antiguo: mock_pm_<uuid>.
        parts = provider_method_id.split("_")
        if len(parts) >= 4 and parts[1] == "pm":
            candidate = parts[2]
            if candidate in {"success", "declined", "insufficient", "3ds", "timeout", "expired"}:
                return candidate
        return "success"

    def create_setup_intent(self, *, customer_id: str) -> dict[str, Any]:
        self._ensure_customer(customer_id)
        return {
            "client_secret": f"mock_setup_{uuid.uuid4().hex}",
            "status": "requires_confirmation",
            "provider": self.name,
        }

    def attach_payment_method(self, *, customer_id: str, token: str) -> ProviderPaymentMethod:
        self._ensure_customer(customer_id)
        data = _TOKEN_DATA.get(token)
        if data is None:
            raise ValueError(f"Token mock desconocido: {token}")
        brand, last4, exp_month, exp_year, scenario = data
        method_id = f"mock_pm_{scenario}_{uuid.uuid4().hex[:16]}"
        with self._lock:
            self._methods[method_id] = {
                "customer_id": customer_id,
                "brand": brand,
                "last4": last4,
                "exp_month": exp_month,
                "exp_year": exp_year,
                "scenario": scenario,
                "removed": False,
            }
            self._customers[customer_id]["methods"].append(method_id)
        return ProviderPaymentMethod(
            provider_method_id=method_id,
            brand=brand,
            last4=last4,
            exp_month=exp_month,
            exp_year=exp_year,
        )

    def list_payment_methods(self, *, customer_id: str) -> list[ProviderPaymentMethod]:
        self._ensure_customer(customer_id)
        result = []
        for method_id in self._customers[customer_id]["methods"]:
            method = self._methods.get(method_id)
            if not method or method["removed"]:
                continue
            result.append(
                ProviderPaymentMethod(
                    provider_method_id=method_id,
                    brand=method["brand"],
                    last4=method["last4"],
                    exp_month=method["exp_month"],
                    exp_year=method["exp_year"],
                )
            )
        return result

    def set_default_payment_method(self, *, customer_id: str, provider_method_id: str) -> None:
        self._ensure_customer(customer_id)
        method = self._methods.get(provider_method_id)
        if method and not method["removed"]:
            if method["customer_id"] != customer_id:
                raise ValueError("Método mock no válido para este cliente")
        with self._lock:
            self._customers[customer_id]["default_method_id"] = provider_method_id

    def remove_payment_method(self, *, provider_method_id: str) -> None:
        method = self._methods.get(provider_method_id)
        if not method:
            # El estado mock en memoria se pierde al reiniciar el servidor.
            return
        with self._lock:
            method["removed"] = True
            customer = self._customers.get(method["customer_id"])
            if customer and customer.get("default_method_id") == provider_method_id:
                customer["default_method_id"] = None

    def _payment_result(
        self,
        *,
        reference: str,
        scenario: str,
    ) -> ProviderPaymentResult:
        if scenario == "success":
            return ProviderPaymentResult(reference=reference, status="succeeded")
        if scenario == "3ds":
            return ProviderPaymentResult(
                reference=reference,
                status="requires_action",
                next_action="mock_3ds",
            )
        failures = {
            "declined": ("card_declined", "La tarjeta fue rechazada."),
            "insufficient": ("insufficient_funds", "Fondos insuficientes."),
            "timeout": ("provider_timeout", "El proveedor no respondió a tiempo."),
            "expired": ("expired_card", "La tarjeta está expirada."),
        }
        code, message = failures.get(scenario, ("payment_failed", "No se pudo procesar el pago."))
        return ProviderPaymentResult(
            reference=reference,
            status="failed",
            failure_code=code,
            failure_message=message,
        )

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
        with self._lock:
            cached = self._idempotency.get(idempotency_key)
        if cached is not None:
            return cached

        if amount_cents <= 0:
            raise ValueError("El monto debe ser mayor que cero")
        self._ensure_customer(customer_id)
        method = self._methods.get(provider_method_id)
        if method and (method["removed"] or method["customer_id"] != customer_id):
            raise ValueError("Método de pago mock no válido")
        if not method:
            # Rehidrata tras un reinicio del servidor de desarrollo.
            method = {
                "customer_id": customer_id,
                "scenario": self._scenario_from_method(provider_method_id),
                "removed": False,
            }
            with self._lock:
                self._methods[provider_method_id] = method

        self._delay()
        reference = f"mock_pi_{uuid.uuid4().hex[:16]}"
        result = self._payment_result(reference=reference, scenario=method["scenario"])
        with self._lock:
            self._payments[reference] = {
                "reference": reference,
                "status": result.status,
                "amount_cents": amount_cents,
                "currency": currency,
                "metadata": metadata or {},
                "failure_code": result.failure_code,
                "failure_message": result.failure_message,
            }
            self._idempotency[idempotency_key] = result
        return result

    def confirm_payment(self, *, reference: str) -> ProviderPaymentResult:
        payment = self._payments.get(reference)
        if not payment:
            if reference.startswith("mock_pi_"):
                return ProviderPaymentResult(reference=reference, status="succeeded")
            raise ValueError("Pago mock no encontrado")
        if payment["status"] == "requires_action":
            with self._lock:
                payment["status"] = "succeeded"
            return ProviderPaymentResult(reference=reference, status="succeeded")
        return ProviderPaymentResult(
            reference=reference,
            status=payment["status"],
            failure_code=payment.get("failure_code"),
            failure_message=payment.get("failure_message"),
        )

    def refund_payment(self, *, reference: str, amount_cents: int | None = None) -> ProviderPaymentResult:
        payment = self._payments.get(reference)
        if not payment:
            if reference.startswith("mock_pi_"):
                return ProviderPaymentResult(reference=f"mock_re_{uuid.uuid4().hex[:16]}", status="refunded")
            raise ValueError("Pago mock no encontrado")
        if payment["status"] != "succeeded":
            return ProviderPaymentResult(
                reference=reference,
                status="failed",
                failure_code="not_refundable",
                failure_message="Solo se pueden reembolsar pagos aprobados.",
            )
        refunded = amount_cents is not None and amount_cents < payment["amount_cents"]
        with self._lock:
            payment["status"] = "partially_refunded" if refunded else "refunded"
        return ProviderPaymentResult(
            reference=f"mock_re_{uuid.uuid4().hex[:16]}",
            status="partially_refunded" if refunded else "refunded",
        )

    def create_payout(
        self,
        *,
        doctor_id: int,
        amount_cents: int,
        currency: str,
        idempotency_key: str,
    ) -> ProviderPaymentResult:
        with self._lock:
            cached = self._idempotency.get(idempotency_key)
        if cached is not None:
            return cached
        if amount_cents <= 0:
            raise ValueError("El monto del payout debe ser mayor que cero")
        self._delay()
        reference = f"mock_po_{uuid.uuid4().hex[:16]}"
        result = ProviderPaymentResult(reference=reference, status="paid")
        with self._lock:
            self._payouts[reference] = {
                "doctor_id": doctor_id,
                "amount_cents": amount_cents,
                "currency": currency,
                "status": "paid",
            }
            self._idempotency[idempotency_key] = result
        return result

    def verify_webhook(self, *, headers: dict[str, str], body: bytes) -> dict[str, Any] | None:
        signature = headers.get("x-mock-signature") or headers.get("X-Mock-Signature")
        if not signature:
            return None
        expected = hmac.new(
            settings.MOCK_PAYMENT_WEBHOOK_SECRET.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return None
        try:
            event = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None
        if not event.get("id") or not event.get("type"):
            return None
        return event

    @staticmethod
    def sign_webhook(body: bytes) -> str:
        return hmac.new(
            settings.MOCK_PAYMENT_WEBHOOK_SECRET.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
