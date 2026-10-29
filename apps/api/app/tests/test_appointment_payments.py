"""Reserva, cotización y confirmación manual del médico."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.session import SessionLocal
from app.main import app
from app.models.appointment import Appointment
from app.models.payment import ConsultationCharge, PaymentCustomer, PaymentMethod
from app.models.user import User
from app.services.payments.factory import mock_payment_provider

client = TestClient(app)
PATIENT_EMAIL = "paciente.demo@sabiodoc.app"
PATIENT_PASSWORD = "PatientDemo123!"
DOCTOR_EMAIL = "cardio.demo@sabiodoc.app"
DOCTOR_PASSWORD = "DemoDoctor123!"


def _auth(email: str, password: str) -> dict[str, str]:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _doctor_id() -> int:
    headers = _auth(DOCTOR_EMAIL, DOCTOR_PASSWORD)
    response = client.get("/doctors/me/application", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["doctor_id"]


def _specialty_id(doctor_id: int) -> int:
    response = client.get(f"/doctors/{doctor_id}")
    assert response.status_code == 200, response.text
    return response.json()["specialties"][0]["id"]


def _patient_id() -> int:
    db = SessionLocal()
    try:
        return db.query(User).filter(User.email == PATIENT_EMAIL).first().id
    finally:
        db.close()


def _cleanup(appointment_ids: list[int]) -> None:
    db = SessionLocal()
    try:
        if appointment_ids:
            db.query(ConsultationCharge).filter(ConsultationCharge.appointment_id.in_(appointment_ids)).delete(
                synchronize_session=False
            )
            db.query(Appointment).filter(Appointment.id.in_(appointment_ids)).delete(synchronize_session=False)
        user_id = db.query(User).filter(User.email == PATIENT_EMAIL).first().id
        db.query(PaymentMethod).filter(PaymentMethod.user_id == user_id).delete(synchronize_session=False)
        db.query(PaymentCustomer).filter(PaymentCustomer.user_id == user_id).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def setup_function():
    mock_payment_provider.reset()
    _cleanup([])


def teardown_function():
    _cleanup([])
    mock_payment_provider.reset()


def test_flujo_cotizacion_reserva_y_confirmacion():
    patient_headers = _auth(PATIENT_EMAIL, PATIENT_PASSWORD)
    doctor_headers = _auth(DOCTOR_EMAIL, DOCTOR_PASSWORD)
    doctor_id = _doctor_id()
    specialty_id = _specialty_id(doctor_id)

    method = client.post(
        "/payments/methods",
        json={"token": "pm_mock_success"},
        headers=patient_headers,
    )
    assert method.status_code == 201, method.text

    quote = client.post(
        "/appointments/quote",
        json={"doctor_id": doctor_id, "duration_minutes": 30},
        headers=patient_headers,
    )
    assert quote.status_code == 200, quote.text
    assert quote.json()["currency"] == "USD"
    assert quote.json()["amount_cents"] > 0

    slots = client.get(f"/doctors/{doctor_id}/bookable-slots?days=14&duration_minutes=30")
    assert slots.status_code == 200, slots.text
    scheduled_at = slots.json()["slots"][0]["starts_at"]

    created = client.post(
        "/appointments",
        json={
            "doctor_id": doctor_id,
            "specialty_id": specialty_id,
            "scheduled_at": scheduled_at,
            "duration_minutes": 30,
            "accepted_terms": True,
            "accepted_data_terms": True,
            "consent_text_version": "v1",
        },
        headers=patient_headers,
    )
    assert created.status_code == 201, created.text
    body = created.json()
    appointment_id = body["id"]
    try:
        assert body["confirmation_status"] == "pending"
        assert body["quoted_amount_cents"] == quote.json()["amount_cents"]

        confirmed = client.post(f"/appointments/{appointment_id}/confirm", headers=doctor_headers)
        assert confirmed.status_code == 200, confirmed.text
        assert confirmed.json()["confirmation_status"] == "confirmed"
        assert confirmed.json()["confirmed_at"] is not None
    finally:
        _cleanup([appointment_id])


def test_rechazo_libera_el_horario():
    patient_headers = _auth(PATIENT_EMAIL, PATIENT_PASSWORD)
    doctor_headers = _auth(DOCTOR_EMAIL, DOCTOR_PASSWORD)
    doctor_id = _doctor_id()
    specialty_id = _specialty_id(doctor_id)
    client.post("/payments/methods", json={"token": "pm_mock_success"}, headers=patient_headers)

    slots = client.get(f"/doctors/{doctor_id}/bookable-slots?days=14&duration_minutes=30")
    scheduled_at = slots.json()["slots"][0]["starts_at"]
    created = client.post(
        "/appointments",
        json={
            "doctor_id": doctor_id,
            "specialty_id": specialty_id,
            "scheduled_at": scheduled_at,
            "duration_minutes": 30,
            "consent_text_version": "v1",
        },
        headers=patient_headers,
    )
    appointment_id = created.json()["id"]
    try:
        declined = client.post(
            f"/appointments/{appointment_id}/decline",
            json={"reason": "No tengo disponibilidad"},
            headers=doctor_headers,
        )
        assert declined.status_code == 200, declined.text
        assert declined.json()["confirmation_status"] == "declined"
        assert declined.json()["status"] == "cancelled"
    finally:
        _cleanup([appointment_id])


def test_solicitud_expirada_se_cancela():
    patient_headers = _auth(PATIENT_EMAIL, PATIENT_PASSWORD)
    doctor_id = _doctor_id()
    specialty_id = _specialty_id(doctor_id)
    client.post("/payments/methods", json={"token": "pm_mock_success"}, headers=patient_headers)

    slots = client.get(f"/doctors/{doctor_id}/bookable-slots?days=14&duration_minutes=30")
    scheduled_at = slots.json()["slots"][0]["starts_at"]
    created = client.post(
        "/appointments",
        json={
            "doctor_id": doctor_id,
            "specialty_id": specialty_id,
            "scheduled_at": scheduled_at,
            "duration_minutes": 30,
            "consent_text_version": "v1",
        },
        headers=patient_headers,
    )
    appointment_id = created.json()["id"]
    try:
        db = SessionLocal()
        try:
            appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
            appointment.confirmation_expires_at = datetime.now(UTC) - timedelta(minutes=1)
            db.commit()
        finally:
            db.close()

        listed = client.get("/appointments/my", headers=patient_headers)
        assert listed.status_code == 200
        item = next(item for item in listed.json()["appointments"] if item["id"] == appointment_id)
        assert item["confirmation_status"] == "expired"
        assert item["status"] == "cancelled"
    finally:
        _cleanup([appointment_id])


def test_reserva_exige_tarjeta():
    patient_headers = _auth(PATIENT_EMAIL, PATIENT_PASSWORD)
    doctor_id = _doctor_id()
    specialty_id = _specialty_id(doctor_id)

    slots = client.get(f"/doctors/{doctor_id}/bookable-slots?days=14&duration_minutes=30")
    scheduled_at = slots.json()["slots"][0]["starts_at"]
    created = client.post(
        "/appointments",
        json={
            "doctor_id": doctor_id,
            "specialty_id": specialty_id,
            "scheduled_at": scheduled_at,
            "duration_minutes": 30,
            "consent_text_version": "v1",
        },
        headers=patient_headers,
    )
    assert created.status_code == 400
    assert "tarjeta" in created.json()["detail"].lower()


def test_slots_marcan_ocupados_y_duracion_de_5_minutos():
    patient_headers = _auth(PATIENT_EMAIL, PATIENT_PASSWORD)
    doctor_headers = _auth(DOCTOR_EMAIL, DOCTOR_PASSWORD)
    doctor_id = _doctor_id()
    client.post("/payments/methods", json={"token": "pm_mock_success"}, headers=patient_headers)

    quote = client.post(
        "/appointments/quote",
        json={"doctor_id": doctor_id, "duration_minutes": 5},
        headers=patient_headers,
    )
    assert quote.status_code == 200, quote.text
    assert quote.json()["duration_minutes"] == 5

    slots = client.get(f"/doctors/{doctor_id}/bookable-slots?days=14&duration_minutes=30")
    assert slots.status_code == 200, slots.text
    available = next(slot for slot in slots.json()["slots"] if slot["available"])
    created = client.post(
        "/appointments",
        json={
            "doctor_id": doctor_id,
            "specialty_id": _specialty_id(doctor_id),
            "scheduled_at": available["starts_at"],
            "duration_minutes": 30,
            "consent_text_version": "v1",
        },
        headers=patient_headers,
    )
    assert created.status_code == 201, created.text
    appointment_id = created.json()["id"]
    try:
        # Confirma para que la cita ocupe el horario en la agenda.
        assert client.post(f"/appointments/{appointment_id}/confirm", headers=doctor_headers).status_code == 200
        refreshed = client.get(f"/doctors/{doctor_id}/bookable-slots?days=14&duration_minutes=30")
        assert refreshed.status_code == 200
        selected = next(
            slot for slot in refreshed.json()["slots"] if slot["starts_at"] == available["starts_at"]
        )
        assert selected["available"] is False
        assert selected["unavailable_reason"] == "occupied"
    finally:
        _cleanup([appointment_id])
