"""Contrato del proveedor de pagos mock."""

import json

import pytest

from app.services.payments.mock_provider import MockPaymentProvider


@pytest.fixture()
def provider():
    instance = MockPaymentProvider()
    yield instance
    instance.reset()


def _customer(provider: MockPaymentProvider) -> str:
    return provider.create_customer(user_id=7, email="ana@example.com")


def _method(provider: MockPaymentProvider, customer_id: str, token: str = "pm_mock_success") -> str:
    return provider.attach_payment_method(customer_id=customer_id, token=token).provider_method_id


def test_customer_setup_y_metodos(provider):
    customer_id = _customer(provider)
    setup = provider.create_setup_intent(customer_id=customer_id)
    assert setup["status"] == "requires_confirmation"
    assert setup["client_secret"].startswith("mock_setup_")

    method = provider.attach_payment_method(customer_id=customer_id, token="pm_mock_success")
    assert method.brand == "Visa"
    assert method.last4 == "4242"
    assert len(provider.list_payment_methods(customer_id=customer_id)) == 1

    provider.remove_payment_method(provider_method_id=method.provider_method_id)
    assert provider.list_payment_methods(customer_id=customer_id) == []


def test_pago_exitoso_es_idempotente(provider):
    customer_id = _customer(provider)
    method_id = _method(provider, customer_id)

    first = provider.create_payment(
        customer_id=customer_id,
        provider_method_id=method_id,
        amount_cents=3000,
        currency="USD",
        idempotency_key="appt-1-initial",
        metadata={"appointment_id": 1},
    )
    second = provider.create_payment(
        customer_id=customer_id,
        provider_method_id=method_id,
        amount_cents=3000,
        currency="USD",
        idempotency_key="appt-1-initial",
    )

    assert first.status == "succeeded"
    assert second.reference == first.reference
    assert first.reference.startswith("mock_pi_")


def test_pago_rechazado_y_fondos_insuficientes(provider):
    customer_id = _customer(provider)
    declined = _method(provider, customer_id, "pm_mock_declined")
    insufficient = _method(provider, customer_id, "pm_mock_insufficient")

    result = provider.create_payment(
        customer_id=customer_id,
        provider_method_id=declined,
        amount_cents=3000,
        currency="USD",
        idempotency_key="appt-2-initial",
    )
    assert result.status == "failed"
    assert result.failure_code == "card_declined"

    result = provider.create_payment(
        customer_id=customer_id,
        provider_method_id=insufficient,
        amount_cents=3000,
        currency="USD",
        idempotency_key="appt-3-initial",
    )
    assert result.failure_code == "insufficient_funds"


def test_pago_3ds_requiere_confirmacion(provider):
    customer_id = _customer(provider)
    method_id = _method(provider, customer_id, "pm_mock_3ds")

    result = provider.create_payment(
        customer_id=customer_id,
        provider_method_id=method_id,
        amount_cents=3000,
        currency="USD",
        idempotency_key="appt-4-initial",
    )
    assert result.status == "requires_action"
    assert result.next_action == "mock_3ds"

    confirmed = provider.confirm_payment(reference=result.reference)
    assert confirmed.status == "succeeded"


def test_reembolso_total_y_parcial(provider):
    customer_id = _customer(provider)
    method_id = _method(provider, customer_id)

    payment = provider.create_payment(
        customer_id=customer_id,
        provider_method_id=method_id,
        amount_cents=3000,
        currency="USD",
        idempotency_key="appt-5-initial",
    )
    partial = provider.refund_payment(reference=payment.reference, amount_cents=1000)
    assert partial.status == "partially_refunded"

    payment2 = provider.create_payment(
        customer_id=customer_id,
        provider_method_id=method_id,
        amount_cents=3000,
        currency="USD",
        idempotency_key="appt-6-initial",
    )
    full = provider.refund_payment(reference=payment2.reference)
    assert full.status == "refunded"


def test_payout_idempotente(provider):
    first = provider.create_payout(
        doctor_id=3,
        amount_cents=2400,
        currency="USD",
        idempotency_key="payout-3-2026-10",
    )
    second = provider.create_payout(
        doctor_id=3,
        amount_cents=2400,
        currency="USD",
        idempotency_key="payout-3-2026-10",
    )
    assert first.status == "paid"
    assert second.reference == first.reference


def test_webhook_firma_valida_e_invalida(provider):
    body = json.dumps({"id": "evt_1", "type": "payment.succeeded"}).encode("utf-8")
    signature = provider.sign_webhook(body)

    assert provider.verify_webhook(headers={"x-mock-signature": signature}, body=body) == {
        "id": "evt_1",
        "type": "payment.succeeded",
    }
    assert provider.verify_webhook(headers={"x-mock-signature": "bad"}, body=body) is None
    assert provider.verify_webhook(headers={}, body=body) is None


def test_metodo_mock_sobrevive_reinicio_del_proceso():
    first = MockPaymentProvider()
    customer_id = first.create_customer(user_id=8, email="reinicio@example.com")
    method_id = first.attach_payment_method(
        customer_id=customer_id,
        token="pm_mock_success",
    ).provider_method_id
    assert method_id.startswith("mock_pm_success_")

    # Simula un reinicio: nueva instancia sin memoria previa.
    second = MockPaymentProvider()
    result = second.create_payment(
        customer_id=customer_id,
        provider_method_id=method_id,
        amount_cents=1000,
        currency="USD",
        idempotency_key="restart-1",
    )
    assert result.status == "succeeded"
