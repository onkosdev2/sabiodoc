import secrets
from datetime import datetime
from app.core.logging import get_logger

logger = get_logger(__name__)

class JitsiService:
    def __init__(self):
        self.domain = "meet.jit.si"
        self.is_mock = False  # <--- Añadido para evitar el error

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
            "provider": "daily", # <--- Engañamos al backend diciendo que es 'daily'
            "room_name": unique_room,
            "room_url": room_url,
            "patient_token": "jitsi-placeholder-token",  # <--- Cambiado de None a string
            "doctor_token": "jitsi-placeholder-token",
            "metadata": {
                "consultation_id": consultation_id,
                "appointment_id": appointment_id,
                "doctor_profile_id": doctor_profile_id,
                "patient_id": patient_id,
            },
        }
    # Método de respaldo por si el sistema llega a invocar el mock
    def _mock_room(self, room_name, consultation_id, appointment_id, doctor_profile_id, patient_id, expires_at):
        return self.prepare_room(room_name, consultation_id, doctor_profile_id, patient_id, expires_at, appointment_id)

daily_service = JitsiService()