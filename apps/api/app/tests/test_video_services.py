from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from app.core.config import settings
from app.services.daily_service import DailyService
from app.services.payment_service import PaymentService
from app.services.pricing_service import pricing_service
from app.services.specialist_assistant import SpecialistAssistant
from app.services.appointment_service import appointment_service
from app.services.video_session_service import video_session_service
from app.routers.video_sessions import _serialize_status


def test_pricing_service_respects_minimum_prepay_minutes():
    amount = pricing_service.calculate_prepay_amount(price_per_min_cents=800, estimated_minutes=5)
    assert amount == max(5, settings.VIDEO_MIN_PREPAY_MINUTES) * 800


def test_pricing_service_rejects_prices_outside_business_range():
    with pytest.raises(ValueError):
        pricing_service.validate_price_per_minute(settings.VIDEO_PRICE_MIN_CENTS - 1)


def test_daily_service_mock_prepare_room(monkeypatch):
    monkeypatch.setattr(settings, "DAILY_API_KEY", None)
    service = DailyService()
    response = service.prepare_room(
        room_name="sabiodoc-room-test",
        consultation_id=10,
        doctor_profile_id=5,
        patient_id=3,
        expires_at=datetime.now(timezone.utc),
    )

    assert response["provider"] == "mock_daily"
    assert response["room_name"] == "sabiodoc-room-test"
    assert response["patient_token"].startswith("mock-patient-")
    assert response["doctor_token"].startswith("mock-doctor-")
    assert response["metadata"]["appointment_id"] is None


def test_payment_service_mock_prepayment(monkeypatch):
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", None)
    service = PaymentService()
    response = service.create_prepayment(
        amount_cents=15000,
        consultation_id=1,
        doctor_profile_id=2,
        patient_id=3,
    )

    assert response["status"] == "waived"
    assert response["reference"].startswith("mock_pi_")


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
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    service = SpecialistAssistant()
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
        provider="daily",
        provider_room_name="room-21",
        started_at=datetime.now(timezone.utc) - timedelta(minutes=3),
        ended_at=None,
        joined_patient_at=None,
        joined_doctor_at=None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=20),
        estimated_minutes=20,
        doctor_note=None,
        followup_instructions=None,
        closed_reason=None,
    )

    serialized = _serialize_status(video_session, "doctor")

    assert serialized.patient_id == 11
    assert serialized.patient_email == "patient@example.com"
