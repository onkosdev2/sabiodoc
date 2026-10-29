"""Estado de cobro y cronómetro de la videoconsulta."""

from datetime import UTC, datetime, timedelta

from app.models.video_session import VideoProvider, VideoSession, VideoSessionStatus
from app.routers.video_sessions import _serialize_status
from app.services.video_session_service import video_session_service


def _make_session(*, billable_seconds: int, price: int, paid: int) -> VideoSession:
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
        payment_amount_cents=paid,
        billable_seconds=billable_seconds,
        expires_at=now + timedelta(hours=1),
        patient_present=True,
        doctor_present=True,
        patient_last_seen_at=now,
        doctor_last_seen_at=now,
    )


def test_importe_cobrado_no_se_calcula_por_minuto():
    # El importe se cobra una vez al iniciar: el cronómetro no lo modifica.
    session = _make_session(billable_seconds=321, price=10, paid=1500)

    status = _serialize_status(
        session,
        "doctor",
        payment_state="paid",
        payment_amount_cents=1500,
        payment_minutes=30,
        payment_fee_cents=300,
        payment_doctor_amount_cents=1200,
    )

    assert status.payment_amount_cents == 1500
    assert status.payment_minutes == 30
    assert status.platform_fee_cents == 300
    assert status.doctor_amount_cents == 1200
    assert status.remaining_seconds == 30 * 60 - 321


def test_presencia_jitsi_caduca_sin_heartbeat():
    now = datetime.now(UTC)
    session = _make_session(billable_seconds=0, price=10, paid=1000)
    session.jitsi_patient_present = True
    session.jitsi_doctor_present = True
    session.jitsi_patient_last_seen_at = now - timedelta(seconds=40)
    session.jitsi_doctor_last_seen_at = now - timedelta(seconds=40)

    assert video_session_service.participant_in_jitsi(session, "patient", now) is False
    assert video_session_service.both_in_jitsi(session, now) is False

    video_session_service.touch_jitsi_participant(session, "patient", now)
    video_session_service.touch_jitsi_participant(session, "doctor", now)

    assert video_session_service.both_in_jitsi(session, now) is True


def test_reconcile_pausa_en_el_ultimo_momento_con_ambos_presentes():
    """No se cobra el tiempo en solitario cuando un participante dejó de dar señales."""
    now = datetime.now(UTC)
    session = _make_session(billable_seconds=0, price=10, paid=1000)
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
    session = _make_session(billable_seconds=123, price=10, paid=1000)
    session.started_at = None

    assert video_session_service.reconcile_timer(session, datetime.now(UTC)) is False
    assert session.billable_seconds == 123
