import secrets
from datetime import datetime
from typing import Optional
from app.core.logging import get_logger

logger = get_logger(__name__)


class JitsiService:
    """Servicio de salas de video basado en Jitsi Meet.

    Se mantiene la etiqueta de proveedor "daily" en las respuestas porque
    ``video_session_service`` la persiste en el enum ``VideoProvider``
    (daily/mock_daily) y la BD no tiene un valor propio para Jitsi.
    """

    def __init__(self):
        self.domain = "meet.jit.si"
        self.is_mock = False

    def prepare_room(
        self,
        room_name: str,
        consultation_id: int | None,
        doctor_profile_id: int,
        patient_id: int,
        expires_at: datetime,
        appointment_id: int | None = None,
    ) -> dict:
        unique_room = f"SabioDoc-{room_name}-{secrets.token_hex(4)}"
        room_url = f"https://{self.domain}/{unique_room}"

        logger.info(f"Sala de Jitsi generada: {room_url}")

        return {
            "provider": "daily",
            "room_name": unique_room,
            "room_url": room_url,
            "patient_token": self.create_meeting_token(
                room_name=unique_room,
                owner_id=patient_id,
                role="patient",
                expires_at=expires_at,
            ),
            "doctor_token": self.create_meeting_token(
                room_name=unique_room,
                owner_id=doctor_profile_id,
                role="doctor",
                expires_at=expires_at,
            ),
            "metadata": {
                "consultation_id": consultation_id,
                "appointment_id": appointment_id,
                "doctor_profile_id": doctor_profile_id,
                "patient_id": patient_id,
            },
        }

    def create_meeting_token(
        self,
        room_name: str,
        owner_id: int,
        role: str,
        expires_at: Optional[datetime] = None,
    ) -> str:
        """Genera un token de acceso a la sala.

        Jitsi Meet público no exige JWT por defecto, por lo que se devuelve un
        token simbólico que identifica sala, rol y participante.
        """
        return f"jitsi-{role}-{owner_id}-{secrets.token_hex(4)}"


daily_service = JitsiService()
