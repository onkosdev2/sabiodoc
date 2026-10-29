"""Cobro inicial y apertura de la conferencia."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.session import SessionLocal
from app.main import app
from app.models.appointment import Appointment
from app.models.payment import (
    ConsultationCharge,
    PaymentCustomer,
    PaymentMethod,
    DoctorEarning,
    PaymentTransaction,
    Payout,
)
from app.models.user import User
from app.models.video_session import VideoSession
from app.models.video_session_event import VideoSessionEvent
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
    return response.json()["doctor_id"]


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
            session_ids = [
                row[0]
                for row in db.query(VideoSession.id)
                .filter(VideoSession.appointment_id.in_(appointment_ids))
                .all()
            ]
            if session_ids:
                db.query(VideoSessionEvent).filter(
                    VideoSessionEvent.video_session_id.in_(session_ids)
                ).delete(synchronize_session=False)
                db.query(VideoSession).filter(VideoSession.id.in_(session_ids)).delete(
                    synchronize_session=False
                )
            db.query(DoctorEarning).filter(
                DoctorEarning.appointment_id.in_(appointment_ids)
            ).delete(synchronize_session=False)
            db.query(PaymentTransaction).filter(
                PaymentTransaction.appointment_id.in_(appointment_ids)
            ).delete(synchronize_session=False)
            db.query(ConsultationCharge).filter(
                ConsultationCharge.appointment_id.in_(appointment_ids)
            ).delete(synchronize_session=False)
            db.query(Appointment).filter(Appointment.id.in_(appointment_ids)).delete(
                synchronize_session=False
            )
        doctor_user = db.query(User).filter(User.email == DOCTOR_EMAIL).first()
        if doctor_user and doctor_user.doctor_profile:
            db.query(Payout).filter(Payout.doctor_id == doctor_user.doctor_profile.id).delete(
                synchronize_session=False
            )
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


def _create_appointment(token: str) -> tuple[int, dict[str, str], dict[str, str]]:
    patient_headers = _auth(PATIENT_EMAIL, PATIENT_PASSWORD)
    doctor_headers = _auth(DOCTOR_EMAIL, DOCTOR_PASSWORD)
    doctor_id = _doctor_id()
    doctor_detail = client.get(f"/doctors/{doctor_id}")
    specialty_id = doctor_detail.json()["specialties"][0]["id"]

    method = client.post("/payments/methods", json={"token": token}, headers=patient_headers)
    assert method.status_code == 201, method.text

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
    assert created.status_code == 201, created.text
    appointment_id = created.json()["id"]

    # Acercamos la cita para que la sala esté dentro de la ventana de acceso.
    db = SessionLocal()
    try:
        appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        appointment.scheduled_at = datetime.now(UTC) + timedelta(minutes=10)
        db.commit()
    finally:
        db.close()

    confirmed = client.post(f"/appointments/{appointment_id}/confirm", headers=doctor_headers)
    assert confirmed.status_code == 200, confirmed.text
    return appointment_id, patient_headers, doctor_headers


def _prepare_and_join(appointment_id: int, patient_headers, doctor_headers):
    prepared = client.post(
        f"/appointments/{appointment_id}/video-session/prepare",
        headers=doctor_headers,
    )
    assert prepared.status_code == 200, prepared.text
    video_session_id = prepared.json()["video_session_id"]
    assert client.post(f"/video-sessions/{video_session_id}/join", headers=patient_headers).status_code == 200
    assert client.post(f"/video-sessions/{video_session_id}/join", headers=doctor_headers).status_code == 200
    return video_session_id


def test_cobro_inicial_exitoso_y_timer_al_entrar_ambos():
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_success")
    try:
        video_session_id = _prepare_and_join(appointment_id, patient_headers, doctor_headers)
        assert client.post(
            f"/video-sessions/{video_session_id}/jitsi-event",
            json={"event": "joined"},
            headers=patient_headers,
        ).status_code == 204
        assert client.post(
            f"/video-sessions/{video_session_id}/jitsi-event",
            json={"event": "joined"},
            headers=doctor_headers,
        ).status_code == 204

        start = client.post(f"/video-sessions/{video_session_id}/start", headers=doctor_headers)
        assert start.status_code == 200, start.text
        body = start.json()
        assert body["payment_state"] == "paid"
        assert body["status"] == "active"
        assert body["started_at"] is not None
        assert body["payment_amount_cents"] > 0
        assert body["payment_minutes"] == 30
    finally:
        _cleanup([appointment_id])


def test_reanudar_consulta_despues_de_pausa():
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_success")
    try:
        video_session_id = _prepare_and_join(appointment_id, patient_headers, doctor_headers)
        for headers in (patient_headers, doctor_headers):
            client.post(
                f"/video-sessions/{video_session_id}/jitsi-event",
                json={"event": "joined"},
                headers=headers,
            )

        started = client.post(f"/video-sessions/{video_session_id}/start", headers=doctor_headers)
        assert started.status_code == 200, started.text
        assert started.json()["started_at"] is not None
        first_payment = started.json()["payment_amount_cents"]

        paused = client.post(f"/video-sessions/{video_session_id}/pause", headers=doctor_headers)
        assert paused.status_code == 200, paused.text
        assert paused.json()["started_at"] is None

        resumed = client.post(f"/video-sessions/{video_session_id}/start", headers=doctor_headers)
        assert resumed.status_code == 200, resumed.text
        body = resumed.json()
        assert body["status"] == "active"
        assert body["started_at"] is not None
        assert body["payment_amount_cents"] == first_payment
    finally:
        _cleanup([appointment_id])


def test_salida_por_beacon_detiene_el_timer():
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_success")
    try:
        video_session_id = _prepare_and_join(appointment_id, patient_headers, doctor_headers)
        for headers in (patient_headers, doctor_headers):
            client.post(
                f"/video-sessions/{video_session_id}/jitsi-event",
                json={"event": "joined"},
                headers=headers,
            )
        started = client.post(f"/video-sessions/{video_session_id}/start", headers=doctor_headers)
        assert started.status_code == 200, started.text
        assert started.json()["started_at"] is not None

        patient_token = patient_headers["Authorization"].split()[1]
        beacon = client.post(
            f"/video-sessions/{video_session_id}/presence-beacon",
            data={"token": patient_token, "event": "left"},
        )
        assert beacon.status_code == 204, beacon.text

        status = client.get(f"/video-sessions/{video_session_id}", headers=doctor_headers)
        assert status.status_code == 200, status.text
        assert status.json()["started_at"] is None
    finally:
        _cleanup([appointment_id])


def test_pago_rechazado_no_abre_conferencia_ni_timer():
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_declined")
    try:
        video_session_id = _prepare_and_join(appointment_id, patient_headers, doctor_headers)
        client.post(
            f"/video-sessions/{video_session_id}/jitsi-event",
            json={"event": "joined"},
            headers=patient_headers,
        )
        client.post(
            f"/video-sessions/{video_session_id}/jitsi-event",
            json={"event": "joined"},
            headers=doctor_headers,
        )
        start = client.post(f"/video-sessions/{video_session_id}/start", headers=doctor_headers)
        assert start.status_code == 402, start.text

        status = client.get(f"/video-sessions/{video_session_id}", headers=doctor_headers)
        assert status.json()["payment_state"] == "failed"
        assert status.json()["started_at"] is None
    finally:
        _cleanup([appointment_id])


def test_pago_3ds_se_confirma_y_luego_inicia():
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_3ds")
    try:
        video_session_id = _prepare_and_join(appointment_id, patient_headers, doctor_headers)
        client.post(
            f"/video-sessions/{video_session_id}/jitsi-event",
            json={"event": "joined"},
            headers=patient_headers,
        )
        client.post(
            f"/video-sessions/{video_session_id}/jitsi-event",
            json={"event": "joined"},
            headers=doctor_headers,
        )
        start = client.post(f"/video-sessions/{video_session_id}/start", headers=doctor_headers)
        assert start.status_code == 200, start.text
        assert start.json()["payment_state"] == "requires_action"

        doctor_forbidden = client.post(
            f"/video-sessions/{video_session_id}/confirm-payment",
            headers=doctor_headers,
        )
        assert doctor_forbidden.status_code == 403, doctor_forbidden.text

        confirmed = client.post(
            f"/video-sessions/{video_session_id}/confirm-payment",
            headers=patient_headers,
        )
        assert confirmed.status_code == 200, confirmed.text
        assert confirmed.json()["payment_state"] == "paid"
        assert confirmed.json()["status"] == "active"
    finally:
        _cleanup([appointment_id])


def _pay_and_exhaust_time(appointment_id, patient_headers, doctor_headers):
    video_session_id = _prepare_and_join(appointment_id, patient_headers, doctor_headers)
    client.post(
        f"/video-sessions/{video_session_id}/jitsi-event",
        json={"event": "joined"},
        headers=patient_headers,
    )
    client.post(
        f"/video-sessions/{video_session_id}/jitsi-event",
        json={"event": "joined"},
        headers=doctor_headers,
    )
    start = client.post(f"/video-sessions/{video_session_id}/start", headers=doctor_headers)
    assert start.status_code == 200, start.text
    assert start.json()["payment_state"] == "paid"

    # Simula que ya se consumió el tiempo pagado.
    db = SessionLocal()
    try:
        video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
        video_session.status = video_session.status.__class__.active
        video_session.started_at = datetime.now(UTC) - timedelta(minutes=video_session.estimated_minutes + 1)
        video_session.jitsi_patient_present = True
        video_session.jitsi_doctor_present = True
        db.commit()
    finally:
        db.close()

    status = client.get(f"/video-sessions/{video_session_id}", headers=doctor_headers)
    assert status.status_code == 200, status.text
    assert status.json()["status"] == "extension_pending"
    return video_session_id


def test_ampliacion_en_curso_conserva_tiempo_transcurrido():
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_success")
    try:
        video_session_id = _prepare_and_join(appointment_id, patient_headers, doctor_headers)
        for headers in (patient_headers, doctor_headers):
            client.post(
                f"/video-sessions/{video_session_id}/jitsi-event",
                json={"event": "joined"},
                headers=headers,
            )
        started = client.post(f"/video-sessions/{video_session_id}/start", headers=doctor_headers)
        assert started.status_code == 200, started.text

        db = SessionLocal()
        try:
            video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
            video_session.started_at = datetime.now(UTC) - timedelta(seconds=60)
            db.commit()
        finally:
            db.close()

        requested = client.post(
            f"/video-sessions/{video_session_id}/extend",
            json={"minutes": 5},
            headers=doctor_headers,
        )
        assert requested.status_code == 200, requested.text
        requested_body = requested.json()
        assert requested_body["status"] == "extension_requested"
        assert requested_body["extension_request_pending"] is True
        assert requested_body["started_at"] is None
        assert requested_body["elapsed_seconds"] >= 59

        confirmed = client.post(
            f"/video-sessions/{video_session_id}/extend/confirm",
            headers=patient_headers,
        )
        assert confirmed.status_code == 200, confirmed.text
        body = confirmed.json()
        assert body["estimated_minutes"] == 35
        assert body["started_at"] is not None
        assert body["elapsed_seconds"] >= 59
        assert body["extension_request_pending"] is False
    finally:
        _cleanup([appointment_id])


def test_ampliacion_exitosa():
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_success")
    try:
        video_session_id = _pay_and_exhaust_time(appointment_id, patient_headers, doctor_headers)
        requested = client.post(
            f"/video-sessions/{video_session_id}/extend",
            json={"minutes": 5},
            headers=doctor_headers,
        )
        assert requested.status_code == 200, requested.text
        assert requested.json()["status"] == "extension_requested"
        assert requested.json()["estimated_minutes"] == 30
        assert requested.json()["extension_requested_minutes"] == 5

        doctor_cannot_confirm = client.post(
            f"/video-sessions/{video_session_id}/extend/confirm",
            headers=doctor_headers,
        )
        assert doctor_cannot_confirm.status_code == 403, doctor_cannot_confirm.text

        extended = client.post(
            f"/video-sessions/{video_session_id}/extend/confirm",
            headers=patient_headers,
        )
        assert extended.status_code == 200, extended.text
        body = extended.json()
        assert body["status"] == "active"
        assert body["estimated_minutes"] == 35
        assert body["payment_state"] == "paid"
        assert body["payment_minutes"] == 35
        assert body["payment_amount_cents"] == 35 * body["price_per_min_cents"]
        assert body["extension_request_pending"] is False
    finally:
        _cleanup([appointment_id])


def test_ampliacion_rechazada_no_agrega_tiempo():
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_success")
    try:
        video_session_id = _pay_and_exhaust_time(appointment_id, patient_headers, doctor_headers)
        declined = client.post(
            "/payments/methods",
            json={"token": "pm_mock_declined"},
            headers=patient_headers,
        )
        assert declined.status_code == 201
        db = SessionLocal()
        try:
            from app.models.payment import ConsultationCharge

            charge = db.query(ConsultationCharge).filter(
                ConsultationCharge.appointment_id == appointment_id
            ).first()
            charge.payment_method_id = declined.json()["id"]
            db.commit()
        finally:
            db.close()

        requested = client.post(
            f"/video-sessions/{video_session_id}/extend",
            json={"minutes": 5},
            headers=doctor_headers,
        )
        assert requested.status_code == 200, requested.text
        assert requested.json()["status"] == "extension_requested"

        response = client.post(
            f"/video-sessions/{video_session_id}/extend/confirm",
            headers=patient_headers,
        )
        assert response.status_code == 402, response.text
        status = client.get(f"/video-sessions/{video_session_id}", headers=doctor_headers)
        assert status.json()["status"] == "extension_requested"
        assert status.json()["estimated_minutes"] == 30
        assert status.json()["extension_request_pending"] is True
    finally:
        _cleanup([appointment_id])


def test_paciente_rechaza_ampliacion_sin_cobro():
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_success")
    try:
        video_session_id = _pay_and_exhaust_time(appointment_id, patient_headers, doctor_headers)
        requested = client.post(
            f"/video-sessions/{video_session_id}/extend",
            json={"minutes": 5},
            headers=doctor_headers,
        )
        assert requested.status_code == 200, requested.text
        initial_amount = requested.json()["payment_amount_cents"]

        rejected = client.post(
            f"/video-sessions/{video_session_id}/extend/reject",
            headers=patient_headers,
        )
        assert rejected.status_code == 200, rejected.text
        body = rejected.json()
        assert body["status"] == "extension_pending"
        assert body["extension_request_pending"] is False
        assert body["estimated_minutes"] == 30
        assert body["payment_amount_cents"] == initial_amount
    finally:
        _cleanup([appointment_id])


def test_medico_cancela_solicitud_y_puede_reintentar():
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_success")
    try:
        video_session_id = _pay_and_exhaust_time(appointment_id, patient_headers, doctor_headers)
        first = client.post(
            f"/video-sessions/{video_session_id}/extend",
            json={"minutes": 5},
            headers=doctor_headers,
        )
        assert first.status_code == 200, first.text

        cancelled = client.post(
            f"/video-sessions/{video_session_id}/extend/cancel",
            headers=doctor_headers,
        )
        assert cancelled.status_code == 200, cancelled.text
        assert cancelled.json()["extension_request_pending"] is False
        assert cancelled.json()["status"] == "extension_pending"

        second = client.post(
            f"/video-sessions/{video_session_id}/extend",
            json={"minutes": 10},
            headers=doctor_headers,
        )
        assert second.status_code == 200, second.text
        assert second.json()["extension_request_pending"] is True
        assert second.json()["extension_requested_minutes"] == 10
    finally:
        _cleanup([appointment_id])


def test_ampliacion_3ds_la_confirma_el_paciente():
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_3ds")
    try:
        video_session_id = _prepare_and_join(appointment_id, patient_headers, doctor_headers)
        for headers in (patient_headers, doctor_headers):
            client.post(
                f"/video-sessions/{video_session_id}/jitsi-event",
                json={"event": "joined"},
                headers=headers,
            )
        start = client.post(f"/video-sessions/{video_session_id}/start", headers=doctor_headers)
        assert start.status_code == 200, start.text
        assert start.json()["payment_state"] == "requires_action"
        assert client.post(
            f"/video-sessions/{video_session_id}/confirm-payment",
            headers=patient_headers,
        ).status_code == 200

        db = SessionLocal()
        try:
            video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
            video_session.started_at = datetime.now(UTC) - timedelta(minutes=video_session.estimated_minutes + 1)
            db.commit()
        finally:
            db.close()
        assert client.get(
            f"/video-sessions/{video_session_id}", headers=doctor_headers
        ).json()["status"] == "extension_pending"

        requested = client.post(
            f"/video-sessions/{video_session_id}/extend",
            json={"minutes": 5},
            headers=doctor_headers,
        )
        assert requested.status_code == 200, requested.text

        extension_3ds = client.post(
            f"/video-sessions/{video_session_id}/extend/confirm",
            headers=patient_headers,
        )
        assert extension_3ds.status_code == 200, extension_3ds.text
        assert extension_3ds.json()["payment_state"] == "requires_action"
        assert extension_3ds.json()["estimated_minutes"] == 30

        assert client.post(
            f"/video-sessions/{video_session_id}/confirm-payment",
            headers=doctor_headers,
        ).status_code == 403
        confirmed = client.post(
            f"/video-sessions/{video_session_id}/confirm-payment",
            headers=patient_headers,
        )
        assert confirmed.status_code == 200, confirmed.text
        assert confirmed.json()["payment_state"] == "paid"
        assert confirmed.json()["estimated_minutes"] == 35
    finally:
        _cleanup([appointment_id])


def test_sesion_agotada_no_se_reanuda_sin_ampliacion():
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_success")
    try:
        video_session_id = _pay_and_exhaust_time(appointment_id, patient_headers, doctor_headers)

        restart = client.post(f"/video-sessions/{video_session_id}/start", headers=doctor_headers)
        assert restart.status_code == 409, restart.text

        # Volver a entrar a Jitsi no debe reiniciar el cronómetro sin pagar.
        assert client.post(
            f"/video-sessions/{video_session_id}/jitsi-event",
            json={"event": "joined"},
            headers=doctor_headers,
        ).status_code == 204
        status = client.get(f"/video-sessions/{video_session_id}", headers=doctor_headers)
        assert status.json()["status"] == "extension_pending"
        assert status.json()["started_at"] is None
    finally:
        _cleanup([appointment_id])


def test_sin_ampliacion_cierra_por_gracia():
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_success")
    try:
        video_session_id = _pay_and_exhaust_time(appointment_id, patient_headers, doctor_headers)
        db = SessionLocal()
        try:
            video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
            video_session.extension_deadline = datetime.now(UTC) - timedelta(seconds=1)
            db.commit()
        finally:
            db.close()

        status = client.get(f"/video-sessions/{video_session_id}", headers=doctor_headers)
        assert status.status_code == 200
        assert status.json()["status"] == "completed"
    finally:
        _cleanup([appointment_id])


def test_ingresos_payout_y_conciliacion():
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_success")
    try:
        video_session_id = _prepare_and_join(appointment_id, patient_headers, doctor_headers)
        assert client.post(
            f"/video-sessions/{video_session_id}/jitsi-event",
            json={"event": "joined"},
            headers=patient_headers,
        ).status_code == 204
        assert client.post(
            f"/video-sessions/{video_session_id}/jitsi-event",
            json={"event": "joined"},
            headers=doctor_headers,
        ).status_code == 204
        assert client.post(f"/video-sessions/{video_session_id}/start", headers=doctor_headers).status_code == 200
        completed = client.post(
            f"/video-sessions/{video_session_id}/complete",
            json={"closed_reason": "completed_by_doctor"},
            headers=doctor_headers,
        )
        assert completed.status_code == 200, completed.text

        summary = client.get("/earnings/me", headers=doctor_headers)
        assert summary.status_code == 200, summary.text
        assert summary.json()["available_cents"] > 0

        payout = client.post("/earnings/me/payouts", json={}, headers=doctor_headers)
        assert payout.status_code == 201, payout.text
        assert payout.json()["status"] == "paid"

        summary_after = client.get("/earnings/me", headers=doctor_headers)
        assert summary_after.json()["available_cents"] == 0
        assert summary_after.json()["paid_cents"] > 0

        admin_headers = _auth("admin.demo@sabiodoc.app", "AdminDemo123!")
        reconciliation = client.get("/earnings/admin/reconciliation", headers=admin_headers)
        assert reconciliation.status_code == 200, reconciliation.text
        assert reconciliation.json()["checked_charges"] >= 1
    finally:
        _cleanup([appointment_id])


def test_flujo_e2e_completo():
    """Tarjeta → reserva → confirmación → cobro → extensión → cierre → payout."""
    appointment_id, patient_headers, doctor_headers = _create_appointment("pm_mock_success")
    try:
        video_session_id = _prepare_and_join(appointment_id, patient_headers, doctor_headers)
        client.post(
            f"/video-sessions/{video_session_id}/jitsi-event",
            json={"event": "joined"},
            headers=patient_headers,
        )
        client.post(
            f"/video-sessions/{video_session_id}/jitsi-event",
            json={"event": "joined"},
            headers=doctor_headers,
        )
        start = client.post(f"/video-sessions/{video_session_id}/start", headers=doctor_headers)
        assert start.status_code == 200, start.text
        assert start.json()["payment_state"] == "paid"

        db = SessionLocal()
        try:
            video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
            video_session.started_at = datetime.now(UTC) - timedelta(minutes=video_session.estimated_minutes + 1)
            db.commit()
        finally:
            db.close()

        pending = client.get(f"/video-sessions/{video_session_id}", headers=doctor_headers)
        assert pending.json()["status"] == "extension_pending"

        requested = client.post(
            f"/video-sessions/{video_session_id}/extend",
            json={"minutes": 5},
            headers=doctor_headers,
        )
        assert requested.status_code == 200, requested.text
        assert requested.json()["status"] == "extension_requested"

        extended = client.post(
            f"/video-sessions/{video_session_id}/extend/confirm",
            headers=patient_headers,
        )
        assert extended.status_code == 200, extended.text
        assert extended.json()["estimated_minutes"] == 35

        completed = client.post(
            f"/video-sessions/{video_session_id}/complete",
            json={"closed_reason": "completed_by_doctor"},
            headers=doctor_headers,
        )
        assert completed.status_code == 200, completed.text

        summary = client.get("/earnings/me", headers=doctor_headers)
        assert summary.json()["available_cents"] > 0

        payout = client.post("/earnings/me/payouts", json={}, headers=doctor_headers)
        assert payout.status_code == 201, payout.text
        assert payout.json()["status"] == "paid"

        admin_headers = _auth("admin.demo@sabiodoc.app", "AdminDemo123!")
        reconciliation = client.get("/earnings/admin/reconciliation", headers=admin_headers)
        assert reconciliation.status_code == 200
        assert reconciliation.json()["ok"] is True
    finally:
        _cleanup([appointment_id])
