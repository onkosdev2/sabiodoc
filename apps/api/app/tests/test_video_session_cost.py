"""Costo real de la videoconsulta en el estado de la sesión."""

from datetime import UTC, datetime, timedelta

from app.models.video_session import VideoProvider, VideoSession, VideoSessionStatus
from app.routers.video_sessions import _serialize_status
from app.services.video_session_service import video_session_service


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


def test_reconcile_pausa_en_el_ultimo_momento_con_ambos_presentes():
    """No se cobra el tiempo en solitario cuando un participante dejó de dar señales."""
    now = datetime.now(UTC)
    session = _make_session(billable_seconds=0, price=10, prepaid=1000)
    session.started_at = now - timedelta(minutes=10)
    session.patient_last_seen_at = now - timedelta(minutes=7)
    session.doctor_last_seen_at = now - timedelta(minutes=9)

    paused = video_session_service.reconcile_timer(session, now)

    assert paused is True
    assert session.started_at is None
    # Empezó hace 10 min y el último momento con ambos fue hace 9 min:
    # solo 60 s facturables, no los 600 s completos.
    assert session.billable_seconds == 60


def test_reconcile_no_hace_nada_si_el_cronometro_no_esta_activo():
    session = _make_session(billable_seconds=123, price=10, prepaid=1000)
    session.started_at = None

    assert video_session_service.reconcile_timer(session, datetime.now(UTC)) is False
    assert session.billable_seconds == 123
