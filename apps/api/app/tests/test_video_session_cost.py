"""Costo real de la videoconsulta en el estado de la sesión."""

from datetime import UTC, datetime, timedelta

from app.models.video_session import VideoProvider, VideoSession, VideoSessionStatus
from app.routers.video_sessions import _serialize_status


def _make_session(*, billable_seconds: int, price: int, prepaid: int) -> VideoSession:
    now = datetime.now(UTC)
    return VideoSession(
        id=1,
        appointment_id=1,
        patient_id=1,
        doctor_id=1,
        provider=VideoProvider.jitsi,
        status=VideoSessionStatus.active,
        provider_room_name="sabiodoc-room",
        doctor_price_per_min_cents=price,
        estimated_minutes=30,
        prepaid_amount_cents=prepaid,
        billable_seconds=billable_seconds,
        expires_at=now + timedelta(hours=1),
        patient_present=True,
        doctor_present=True,
        patient_last_seen_at=now,
        doctor_last_seen_at=now,
    )


def test_costo_real_se_calcula_aunque_no_haya_retencion():
    # El caso de las citas de prueba: sin prepago, antes mostraba siempre 0.
    session = _make_session(billable_seconds=321, price=10, prepaid=0)

    status = _serialize_status(session, "doctor")

    # 321 s -> 6 minutos facturables * 10 cent/min = 60 centavos.
    assert status.current_cost_cents == 60
    assert status.held_amount_cents == 0


def test_costo_cero_si_no_ha_transcurrido_tiempo():
    session = _make_session(billable_seconds=0, price=10, prepaid=1000)

    status = _serialize_status(session, "doctor")

    assert status.current_cost_cents == 0
    assert status.held_amount_cents == 1000
