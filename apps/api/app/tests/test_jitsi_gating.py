"""Regla de presencia real en Jitsi: no se cobra ni inicia sin ambos dentro."""

from datetime import UTC, datetime, timedelta

from app.models.video_session import PaymentStatus, VideoProvider, VideoSession, VideoSessionStatus
from app.services.jitsi_service import is_private_or_local_host
from app.services.video_session_service import video_session_service


def _session(provider: VideoProvider) -> VideoSession:
    now = datetime.now(UTC)
    session = VideoSession(
        patient_id=1,
        doctor_id=1,
        provider=provider,
        status=VideoSessionStatus.prepared,
        payment_status=PaymentStatus.authorized,
        provider_room_name="room-test",
        doctor_price_per_min_cents=500,
        estimated_minutes=30,
        prepaid_amount_cents=15000,
        expires_at=now + timedelta(hours=1),
    )
    # Ambos presentes en la app (heartbeat), pero aún no en Jitsi.
    session.patient_present = True
    session.doctor_present = True
    session.patient_last_seen_at = now
    session.doctor_last_seen_at = now
    return session


def test_host_privado_se_detecta():
    assert is_private_or_local_host("192.168.1.123") is True
    assert is_private_or_local_host("10.0.0.5") is True
    assert is_private_or_local_host("127.0.0.1") is True
    assert is_private_or_local_host("localhost") is True
    assert is_private_or_local_host("meet.jit.si") is False
    assert is_private_or_local_host("jitsi.midominio.com") is False


def test_sala_jitsi_exige_ambos_dentro_para_cobrar():
    session = _session(VideoProvider.jitsi)
    assert video_session_service.requires_jitsi(session) is True

    # Solo con presencia de la app no alcanza: no se inicia ni se cobra.
    assert video_session_service.both_participants_present(session) is False

    # Al entrar ambos a la conferencia, recién entonces corre el cronómetro.
    video_session_service.set_jitsi_presence(session, "doctor", True)
    assert video_session_service.both_participants_present(session) is False
    video_session_service.set_jitsi_presence(session, "patient", True)
    assert video_session_service.both_participants_present(session) is True

    # Si uno sale, se vuelve a pausar.
    video_session_service.set_jitsi_presence(session, "patient", False)
    assert video_session_service.both_participants_present(session) is False


def test_sala_mock_no_exige_eventos_de_jitsi():
    session = _session(VideoProvider.jitsi_mock)
    if video_session_service.requires_jitsi(session):
        # Solo aplica si el servicio real está configurado; en mock no debe exigir.
        raise AssertionError("una sala mock no debe exigir eventos de Jitsi")
    assert video_session_service.both_participants_present(session) is True
