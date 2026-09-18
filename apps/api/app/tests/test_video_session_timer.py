"""Control del cronometro (solo medico) y guion de apertura IA."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.doctor_profile import DoctorProfile
from app.models.user import User
from app.models.video_session import (
    PaymentStatus,
    VideoProvider,
    VideoSession,
    VideoSessionStatus,
)
from app.models.video_session_event import VideoSessionEvent

client = TestClient(app)

DOCTOR_EMAIL = "cardio.demo@sabiodoc.app"
DOCTOR_PASSWORD = "DemoDoctor123!"
PATIENT_EMAIL = "paciente.demo@sabiodoc.app"
PATIENT_PASSWORD = "PatientDemo123!"


def _login(email: str, password: str) -> str:
    response = client.post("/auth/login", json={"email": email, "password": password})
    if response.status_code != 200:
        pytest.skip(f"{email} no disponible en la base de datos")
    return response.json()["access_token"]


def _auth(email: str, password: str) -> dict:
    return {"Authorization": f"Bearer {_login(email, password)}"}


def _ids() -> tuple[int, int]:
    db = SessionLocal()
    try:
        patient = db.query(User).filter(User.email == PATIENT_EMAIL).first()
        doctor_user = db.query(User).filter(User.email == DOCTOR_EMAIL).first()
        assert patient and doctor_user
        doctor = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor_user.id).first()
        assert doctor
        return patient.id, doctor.id
    finally:
        db.close()


def _create_session(patient_id: int, doctor_id: int) -> int:
    db = SessionLocal()
    try:
        session = VideoSession(
            patient_id=patient_id,
            doctor_id=doctor_id,
            provider=VideoProvider.jitsi_mock,
            status=VideoSessionStatus.prepared,
            payment_status=PaymentStatus.pending,
            provider_room_name=f"sabiodoc-test-{uuid.uuid4().hex[:10]}",
            doctor_price_per_min_cents=2200,
            estimated_minutes=30,
            prepaid_amount_cents=0,
            expires_at=datetime.now(UTC) + timedelta(minutes=30),
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session.id
    finally:
        db.close()


def _delete_session(video_session_id: int) -> None:
    db = SessionLocal()
    try:
        db.query(VideoSessionEvent).filter(VideoSessionEvent.video_session_id == video_session_id).delete(
            synchronize_session=False
        )
        db.query(VideoSession).filter(VideoSession.id == video_session_id).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def test_doctor_controls_timer_and_patient_cannot():
    patient_id, doctor_id = _ids()
    video_session_id = _create_session(patient_id, doctor_id)
    try:
        doctor_headers = _auth(DOCTOR_EMAIL, DOCTOR_PASSWORD)

        start = client.post(f"/video-sessions/{video_session_id}/start", headers=doctor_headers)
        assert start.status_code == 200, start.text
        started = start.json()
        assert started["status"] == "active"
        assert started["started_at"] is not None

        pause = client.post(f"/video-sessions/{video_session_id}/pause", headers=doctor_headers)
        assert pause.status_code == 200, pause.text
        paused = pause.json()
        assert paused["started_at"] is None
        assert paused["billable_seconds"] >= 0

        # El paciente no puede controlar el cronometro.
        forbidden = client.post(f"/video-sessions/{video_session_id}/start", headers=_auth(PATIENT_EMAIL, PATIENT_PASSWORD))
        assert forbidden.status_code == 403, forbidden.text
    finally:
        _delete_session(video_session_id)


def test_join_does_not_start_timer():
    patient_id, doctor_id = _ids()
    video_session_id = _create_session(patient_id, doctor_id)
    try:
        joined = client.post(
            f"/video-sessions/{video_session_id}/join",
            headers=_auth(PATIENT_EMAIL, PATIENT_PASSWORD),
        )
        assert joined.status_code == 200, joined.text
        body = joined.json()
        assert body["joined_patient_at"] is not None
        assert body["started_at"] is None
        assert body["status"] == "prepared"
        assert body["elapsed_seconds"] == 0
    finally:
        _delete_session(video_session_id)


def test_intro_script_is_generated_and_cached(monkeypatch):
    import app.services.video_session_service as service_module

    monkeypatch.setattr(
        service_module.llm_client,
        "chat_text",
        lambda *args, **kwargs: "Hola, soy la doctora. Diga su nombre completo para validar el audio.",
    )

    patient_id, doctor_id = _ids()
    video_session_id = _create_session(patient_id, doctor_id)
    try:
        doctor_headers = _auth(DOCTOR_EMAIL, DOCTOR_PASSWORD)

        first = client.post(f"/video-sessions/{video_session_id}/intro", headers=doctor_headers)
        assert first.status_code == 200, first.text
        assert first.json()["intro_script"] == "Hola, soy la doctora. Diga su nombre completo para validar el audio."

        # La segunda llamada reutiliza el guion guardado (no vuelve a llamar al LLM).
        calls = {"count": 0}

        def _counting(*args, **kwargs):
            calls["count"] += 1
            return "otro guion"

        monkeypatch.setattr(service_module.llm_client, "chat_text", _counting)
        second = client.post(f"/video-sessions/{video_session_id}/intro", headers=doctor_headers)
        assert second.status_code == 200
        assert second.json()["intro_script"] == "Hola, soy la doctora. Diga su nombre completo para validar el audio."
        assert calls["count"] == 0

        # El paciente no puede ver el guion.
        forbidden = client.post(
            f"/video-sessions/{video_session_id}/intro",
            headers=_auth(PATIENT_EMAIL, PATIENT_PASSWORD),
        )
        assert forbidden.status_code == 403
    finally:
        _delete_session(video_session_id)
