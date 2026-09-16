import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import quote

from jose import jwt

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class JitsiService:
    """Salas de video basadas en Jitsi Meet self-hosted.

    Genera la URL de la sala y, si ``JITSI_JWT_SECRET`` está configurado, un
    JWT por participante (paciente/medico) para salas protegidas.
    """

    def __init__(self):
        self.base_url = (settings.JITSI_BASE_URL or "").rstrip("/")
        self.room_prefix = settings.JITSI_ROOM_PREFIX
        self.jwt_secret = settings.JITSI_JWT_SECRET
        self.jwt_app_id = settings.JITSI_JWT_APP_ID
        self.jwt_audience = settings.JITSI_JWT_AUDIENCE
        self.is_mock = not self.base_url

        if self.is_mock:
            logger.warning("Jitsi service running in MOCK mode - JITSI_BASE_URL not configured")
        else:
            logger.info(
                f"Jitsi service initialized for {self.base_url} (jwt={'on' if self.jwt_secret else 'off'})"
            )

    def prepare_room(
        self,
        room_name: str,
        consultation_id: int | None,
        doctor_profile_id: int,
        patient_id: int,
        expires_at: datetime,
        appointment_id: int | None = None,
    ) -> dict:
        unique_room = f"{self.room_prefix}-{room_name}-{secrets.token_hex(3)}"
        room_url = self.build_room_url(unique_room) if not self.is_mock else ""

        patient_token = self.create_meeting_token(
            room_name=unique_room,
            owner_id=patient_id,
            role="patient",
            expires_at=expires_at,
        )
        doctor_token = self.create_meeting_token(
            room_name=unique_room,
            owner_id=doctor_profile_id,
            role="doctor",
            expires_at=expires_at,
        )

        logger.info(f"Sala de Jitsi generada: {room_url or '(mock)'}")

        return {
            "provider": "jitsi",
            "room_name": unique_room,
            "room_url": room_url,
            "patient_token": patient_token,
            "doctor_token": doctor_token,
            "metadata": {
                "consultation_id": consultation_id,
                "appointment_id": appointment_id,
                "doctor_profile_id": doctor_profile_id,
                "patient_id": patient_id,
            },
        }

    def build_room_url(self, room_name: str) -> str:
        return f"{self.base_url}/{room_name}"

    def build_participant_url(self, room_name: str, token: str | None) -> str:
        url = self.build_room_url(room_name)
        if token:
            url = f"{url}?jwt={quote(token)}"
        return url

    def create_meeting_token(
        self,
        room_name: str,
        owner_id: int,
        role: str,
        expires_at: Optional[datetime] = None,
    ) -> str:
        """Genera el JWT de Jitsi para un participante (o "" si no hay secreto)."""
        if not self.jwt_secret:
            return ""

        now = datetime.now(timezone.utc)
        expiry = expires_at or (now + timedelta(hours=2))
        payload = {
            "aud": self.jwt_audience,
            "iss": self.jwt_app_id,
            "sub": settings.JITSI_DOMAIN,
            "room": room_name,
            "exp": int(expiry.timestamp()),
            "nbf": int(now.timestamp()) - 10,
            "context": {
                "user": {
                    "id": str(owner_id),
                    "name": f"{role}-{owner_id}",
                    "moderator": role == "doctor",
                }
            },
        }
        return jwt.encode(payload, self.jwt_secret, algorithm="HS256")


jitsi_service = JitsiService()
