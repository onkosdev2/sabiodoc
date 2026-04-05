import secrets
import httpx
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class PaymentService:
    def __init__(self):
        self.secret_key = settings.STRIPE_SECRET_KEY
        self.currency = settings.STRIPE_CURRENCY
        self.is_mock = not self.secret_key

    def create_prepayment(
        self,
        amount_cents: int,
        consultation_id: int,
        doctor_profile_id: int,
        patient_id: int,
        payment_method_id: str | None = None,
    ) -> dict:
        if self.is_mock:
            logger.warning("Payment service running in MOCK mode")
            return {
                "status": "waived",
                "reference": f"mock_pi_{secrets.token_hex(8)}",
            }

        if not payment_method_id:
            raise ValueError("Se requiere payment_method_id para reservar el prepago")

        payload = {
            "amount": str(amount_cents),
            "currency": self.currency,
            "payment_method": payment_method_id,
            "confirm": "true",
            "capture_method": "manual",
            "metadata[consultation_id]": str(consultation_id),
            "metadata[doctor_profile_id]": str(doctor_profile_id),
            "metadata[patient_id]": str(patient_id),
        }
        headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/x-www-form-urlencoded",
        }

        with httpx.Client(timeout=15.0) as client:
            response = client.post("https://api.stripe.com/v1/payment_intents", headers=headers, data=payload)
            response.raise_for_status()
            payment_intent = response.json()

        return {
            "status": "authorized",
            "reference": payment_intent["id"],
        }


payment_service = PaymentService()
