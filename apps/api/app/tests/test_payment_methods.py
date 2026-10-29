"""Endpoints y servicio de métodos de pago (proveedor mock)."""

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.payment import PaymentCustomer, PaymentMethod
from app.models.user import User
from app.services.payments.factory import mock_payment_provider

client = TestClient(app)
PATIENT_EMAIL = "paciente.demo@sabiodoc.app"
PATIENT_PASSWORD = "PatientDemo123!"


def _auth(email: str = PATIENT_EMAIL, password: str = PATIENT_PASSWORD) -> dict[str, str]:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _patient_id() -> int:
    db = SessionLocal()
    try:
        return db.query(User).filter(User.email == PATIENT_EMAIL).first().id
    finally:
        db.close()


def _clean() -> None:
    db = SessionLocal()
    try:
        user_id = db.query(User).filter(User.email == PATIENT_EMAIL).first().id
        db.query(PaymentMethod).filter(PaymentMethod.user_id == user_id).delete()
        db.query(PaymentCustomer).filter(PaymentCustomer.user_id == user_id).delete()
        db.commit()
    finally:
        db.close()


def setup_function():
    mock_payment_provider.reset()
    _clean()


def teardown_function():
    _clean()
    mock_payment_provider.reset()


def test_config_y_setup_intent():
    headers = _auth()

    config = client.get("/payments/config", headers=headers)
    assert config.status_code == 200
    assert config.json()["provider"] == "mock"
    assert "pm_mock_success" in config.json()["mock_tokens"]

    setup = client.post("/payments/setup-intent", headers=headers)
    assert setup.status_code == 200, setup.text
    assert setup.json()["client_secret"].startswith("mock_setup_")


def test_alta_listado_default_y_baja():
    headers = _auth()

    first = client.post(
        "/payments/methods",
        json={"token": "pm_mock_success"},
        headers=headers,
    )
    assert first.status_code == 201, first.text
    first_body = first.json()
    assert first_body["brand"] == "Visa"
    assert first_body["last4"] == "4242"
    assert first_body["is_default"] is True

    second = client.post(
        "/payments/methods",
        json={"token": "pm_mock_declined"},
        headers=headers,
    )
    assert second.status_code == 201, second.text
    second_body = second.json()
    assert second_body["is_default"] is False

    methods = client.get("/payments/methods", headers=headers)
    assert methods.status_code == 200
    assert len(methods.json()) == 2

    default = client.post(f"/payments/methods/{second_body['id']}/default", headers=headers)
    assert default.status_code == 200
    assert default.json()["is_default"] is True

    deleted = client.delete(f"/payments/methods/{second_body['id']}", headers=headers)
    assert deleted.status_code == 204

    remaining = client.get("/payments/methods", headers=headers)
    assert remaining.status_code == 200
    assert len(remaining.json()) == 1
    assert remaining.json()[0]["is_default"] is True


def test_token_invalido_devuelve_400():
    headers = _auth()

    response = client.post(
        "/payments/methods",
        json={"token": "token-que-no-existe"},
        headers=headers,
    )
    assert response.status_code == 400
