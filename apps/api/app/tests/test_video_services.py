from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from app.core.config import settings
from app.services.jitsi_service import JitsiService
from app.services.pricing_service import pricing_service
from app.services.specialist_assistant import SpecialistAssistant
from app.services.appointment_service import appointment_service
from app.services.video_session_service import video_session_service
from app.routers.video_sessions import _serialize_status


def test_pricing_service_rejects_prices_outside_business_range():
    with pytest.raises(ValueError):
        pricing_service.validate_price_per_minute(settings.VIDEO_PRICE_MIN_CENTS - 1)


def test_jitsi_service_prepare_room():
    service = JitsiService()
    response = service.prepare_room(
        room_name="sabiodoc-room-test",
        consultation_id=10,
        doctor_profile_id=5,
        patient_id=3,
        expires_at=datetime.now(timezone.utc),
    )

    assert response["provider"] == "jitsi"
    assert response["room_name"].startswith("SabioDoc-sabiodoc-room-test-")
    assert response["room_url"].startswith(settings.JITSI_BASE_URL)
    assert isinstance(response["patient_token"], str)
    assert isinstance(response["doctor_token"], str)
    assert response["metadata"]["appointment_id"] is None


def test_appointment_room_window_rejects_too_early():
    appointment = SimpleNamespace(
        scheduled_at=datetime.now(timezone.utc) + timedelta(hours=2),
        duration_minutes=30,
    )

    with pytest.raises(HTTPException) as exc_info:
        video_session_service._validate_appointment_room_window(appointment)

    assert exc_info.value.status_code == 400
    assert "60 minutos antes" in exc_info.value.detail


def test_appointment_room_expiration_extends_past_scheduled_end():
    appointment = SimpleNamespace(
        scheduled_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        duration_minutes=30,
    )

    expiration = video_session_service._build_appointment_expiration(appointment)

    assert expiration >= appointment.scheduled_at + timedelta(minutes=90)


def test_specialist_assistant_mock_generates_structured_intake(monkeypatch):
    service = SpecialistAssistant()
    # El asistente hereda el modo del llm_client; forzamos mock para este test.
    monkeypatch.setattr(service, "is_mock", True)
    messages = [
        {"role": "assistant", "content": "¿Qué te ocurre?"},
        {"role": "user", "content": "Tengo dolor en el pecho y palpitaciones desde hace 2 días. Tomo losartan y me preocupa que haya empeorado."},
        {"role": "user", "content": "Mi papá tuvo infarto y también tengo presión alta."},
    ]

    intake = service.generate_structured_intake("cardiologia", "Cardiología", messages)

    assert intake["chief_complaint"] is not None
    assert intake["symptom_summary"]
    assert intake["duration_and_evolution"] is not None
    assert intake["recommended_focus_for_doctor"]


def test_appointment_serializer_exposes_ai_intake_snapshot():
    appointment = SimpleNamespace(
        id=10,
        consultation_id=4,
        specialty_id=2,
        specialty=SimpleNamespace(name="Cardiología"),
        patient_id=8,
        patient=SimpleNamespace(email="patient@example.com"),
        doctor_id=3,
        doctor=SimpleNamespace(display_name="Dra. Test"),
        status="scheduled",
        scheduled_at=datetime.now(timezone.utc),
        duration_minutes=20,
        patient_note=None,
        ai_summary_snapshot="Resumen IA",
        ai_intake_snapshot_json={"chief_complaint": "Dolor en el pecho", "symptom_summary": ["Palpitaciones"], "duration_and_evolution": "2 dias", "current_medications": [], "relevant_history": [], "risk_factors": [], "red_flags": [], "recommended_focus_for_doctor": ["Confirmar dolor y duración"], "patient_questions_or_goals": [], "completeness": "partial"},
        doctor_note=None,
        followup_instructions=None,
        cancellation_reason=None,
        booked_via_ai=True,
        consent_text_version="v1",
        joined_patient_at=None,
        joined_doctor_at=None,
        no_show_marked_at=None,
        completed_at=None,
        cancelled_at=None,
        created_at=datetime.now(timezone.utc),
        review=[],
    )

    serialized = appointment_service.serialize_appointment(appointment)

    assert serialized.ai_intake_snapshot is not None
    assert serialized.ai_intake_snapshot.chief_complaint == "Dolor en el pecho"


def test_video_session_status_includes_patient_identity():
    video_session = SimpleNamespace(
        id=21,
        consultation_id=5,
        appointment_id=7,
        patient_id=11,
        patient=SimpleNamespace(email="patient@example.com"),
        status="active",
        provider="jitsi",
        provider_room_name="room-21",
        started_at=datetime.now(timezone.utc) - timedelta(minutes=3),
        ended_at=None,
        joined_patient_at=None,
        joined_doctor_at=None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=20),
        estimated_minutes=20,
        billable_seconds=0,
        doctor_price_per_min_cents=500,
        payment_amount_cents=10000,
        patient_present=True,
        doctor_present=True,
        patient_last_seen_at=datetime.now(timezone.utc),
        doctor_last_seen_at=datetime.now(timezone.utc),
        doctor_note=None,
        followup_instructions=None,
        intro_script=None,
        closed_reason=None,
    )

    serialized = _serialize_status(video_session, "doctor")

    assert serialized.patient_id == 11
    assert serialized.patient_email == "patient@example.com"


def test_jitsi_permite_desactivar_moderador(monkeypatch):
    from jose import jwt

    monkeypatch.setattr(settings, "JITSI_BASE_URL", "https://jitsi.example.com")
    monkeypatch.setattr(settings, "JITSI_JWT_SUBJECT", "meet.jitsi")
    monkeypatch.setattr(settings, "JITSI_JWT_SECRET", "test-secret")
    monkeypatch.setattr(settings, "JITSI_MODERATOR_REQUIRED", False)
    service = JitsiService()
    response = service.prepare_room(
        room_name="same-level",
        consultation_id=None,
        doctor_profile_id=1,
        patient_id=2,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )

    for token in (response["patient_token"], response["doctor_token"]):
        payload = jwt.decode(token, "test-secret", algorithms=["HS256"], audience=settings.JITSI_JWT_AUDIENCE)
        assert payload["sub"] == "meet.jitsi"
        assert payload["context"]["user"]["moderator"] is False
        assert payload["context"]["user"]["affiliation"] == "member"


def test_jitsi_moderador_solo_si_se_configura(monkeypatch):
    from jose import jwt

    monkeypatch.setattr(settings, "JITSI_BASE_URL", "https://jitsi.example.com")
    monkeypatch.setattr(settings, "JITSI_JWT_SUBJECT", "meet.jitsi")
    monkeypatch.setattr(settings, "JITSI_JWT_SECRET", "test-secret")
    monkeypatch.setattr(settings, "JITSI_MODERATOR_REQUIRED", True)
    service = JitsiService()
    response = service.prepare_room(
        room_name="doctor-moderator",
        consultation_id=None,
        doctor_profile_id=1,
        patient_id=2,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )

    patient = jwt.decode(
        response["patient_token"], "test-secret", algorithms=["HS256"], audience=settings.JITSI_JWT_AUDIENCE
    )
    doctor = jwt.decode(
        response["doctor_token"], "test-secret", algorithms=["HS256"], audience=settings.JITSI_JWT_AUDIENCE
    )
    assert patient["context"]["user"]["moderator"] is False
    assert patient["context"]["user"]["affiliation"] == "member"
    assert doctor["context"]["user"]["moderator"] is True
    assert doctor["context"]["user"]["affiliation"] == "owner"
    assert doctor["aud"] == "jitsi"
    assert doctor["iss"] == "sabiodoc"
    assert doctor["sub"] == "meet.jitsi"
    assert doctor["room"] == response["room_name"]
