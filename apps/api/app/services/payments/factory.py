from app.core.config import settings
from app.services.payments.base import PaymentProvider
from app.services.payments.mock_provider import MockPaymentProvider
from app.services.payments.niubiz_provider import NiubizPaymentProvider

mock_payment_provider = MockPaymentProvider()
niubiz_payment_provider = NiubizPaymentProvider()


def get_payment_provider() -> PaymentProvider:
    provider = (settings.PAYMENT_PROVIDER or "mock").strip().lower()
    if provider == "mock":
        return mock_payment_provider
    if provider == "niubiz":
        return niubiz_payment_provider
    raise RuntimeError(
        f"Proveedor de pagos '{provider}' no implementado. "
        "Configura PAYMENT_PROVIDER=mock hasta integrar la pasarela real."
    )
