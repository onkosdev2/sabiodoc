import secrets
from datetime import datetime
import httpx
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class DailyService:
    def __init__(self):
        self.api_key = settings.DAILY_API_KEY
        self.base_url = settings.DAILY_BASE_URL.rstrip("/")
        self.domain = settings.DAILY_DOMAIN.rstrip("/")
        self.is_mock = not self.api_key

    def prepare_room(
        self,
        room_name: str,
        consultation_id: int | None,
        doctor_profile_id: int,
        patient_id: int,
        expires_at: datetime,
        appointment_id: int | None = None,
    ) -> dict:
        if self.is_mock:
            logger.warning("Daily service running in MOCK mode")
            return self._mock_room(room_name, consultation_id, appointment_id, doctor_profile_id, patient_id, expires_at)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        exp_seconds = int(expires_at.timestamp())
        room_payload = {
            "name": room_name,
            "properties": {
                "exp": exp_seconds,
                "max_participants": 2,
                "enable_prejoin_ui": True,
                "enable_screenshare": False,
                "enable_chat": False,
                "enable_recording": False,
                "start_video_off": False,
                "start_audio_off": False,
            },
        }

        with httpx.Client(timeout=15.0) as client:
            room_response = client.post(f"{self.base_url}/rooms", headers=headers, json=room_payload)
            room_response.raise_for_status()
            room_data = room_response.json()

            patient_token = self._request_meeting_token(
                client,
                headers,
                room_name,
                patient_id,
                "patient",
                exp_seconds,
            )
            doctor_token = self._request_meeting_token(
                client,
                headers,
                room_name,
                doctor_profile_id,
                "doctor",
                exp_seconds,
            )

        return {
            "provider": "daily",
            "room_name": room_name,
            "room_url": room_data.get("url"),
            "patient_token": patient_token,
            "doctor_token": doctor_token,
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
        expires_at: datetime,
    ) -> str:
        if self.is_mock:
            return f"mock-{role}-{secrets.token_urlsafe(16)}"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        exp_seconds = int(expires_at.timestamp())
        with httpx.Client(timeout=15.0) as client:
            return self._request_meeting_token(
                client=client,
                headers=headers,
                room_name=room_name,
                owner_id=owner_id,
                role=role,
                exp_seconds=exp_seconds,
            )

    def _request_meeting_token(
        self,
        client: httpx.Client,
        headers: dict,
        room_name: str,
        owner_id: int,
        role: str,
        exp_seconds: int,
    ) -> str:
        token_payload = {
            "properties": {
                "room_name": room_name,
                "user_name": f"{role}-{owner_id}",
                "is_owner": role == "doctor",
                "exp": exp_seconds,
            }
        }
        token_response = client.post(f"{self.base_url}/meeting-tokens", headers=headers, json=token_payload)
        token_response.raise_for_status()
        return token_response.json()["token"]

    def _mock_room(
        self,
        room_name: str,
        consultation_id: int | None,
        appointment_id: int | None,
        doctor_profile_id: int,
        patient_id: int,
        expires_at: datetime,
    ) -> dict:
        token_suffix = secrets.token_urlsafe(16)
        return {
            "provider": "mock_daily",
            "room_name": room_name,
            "room_url": f"{self.domain}/{room_name}",
            "patient_token": f"mock-patient-{token_suffix}",
            "doctor_token": f"mock-doctor-{token_suffix}",
            "metadata": {
                "mock": True,
                "consultation_id": consultation_id,
                "appointment_id": appointment_id,
                "doctor_profile_id": doctor_profile_id,
                "patient_id": patient_id,
                "expires_at": expires_at.isoformat(),
            },
        }


daily_service = DailyService()
