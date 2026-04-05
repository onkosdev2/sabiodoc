import json
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.logging import get_logger
from app.models.appointment import Appointment, AppointmentStatus
from app.models.consultation import Consultation
from app.models.doctor_presence import DoctorPresenceStatus
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.doctor_specialty import DoctorSpecialty
from app.models.user import User, UserRole
from app.models.video_session import PaymentStatus, VideoSession, VideoSessionStatus, VideoProvider
from app.models.video_session_event import VideoSessionEvent
from sqlalchemy import and_, or_
from app.services.daily_service import daily_service
from app.services.payment_service import payment_service
from app.services.pricing_service import pricing_service

logger = get_logger(__name__)


class VideoSessionService:
    APPOINTMENT_ROOM_OPEN_MINUTES_BEFORE = 60
    APPOINTMENT_ROOM_CLOSE_MINUTES_AFTER = 180

    def prepare_session(
        self,
        db: Session,
        consultation: Consultation,
        patient_id: int,
        doctor_profile_id: int,
        estimated_minutes: int,
        payment_method_id: str | None = None,
    ) -> dict:
        doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_profile_id).first()
        if not doctor_profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medico no encontrado")

        if doctor_profile.user.role.value != "doctor":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El usuario seleccionado no es medico")

        if not doctor_profile.is_accepting_consultations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El medico no esta aceptando videoconsultas en este momento",
            )

        if doctor_profile.status != DoctorApprovalStatus.approved:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El medico aun no esta aprobado para atender videoconsultas",
            )

        specialty_link = (
            db.query(DoctorSpecialty)
            .filter(
                DoctorSpecialty.doctor_id == doctor_profile.id,
                DoctorSpecialty.specialty_id == consultation.specialty_id,
            )
            .first()
        )
        if not specialty_link:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El medico no atiende la especialidad de esta consulta",
            )

        presence = doctor_profile.presence
        if not presence or presence.status != DoctorPresenceStatus.online:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El medico no esta disponible ahora mismo",
            )

        active_session = (
            db.query(VideoSession)
            .filter(
                VideoSession.doctor_id == doctor_profile.id,
                or_(
                    VideoSession.status == VideoSessionStatus.active,
                    and_(
                        VideoSession.status == VideoSessionStatus.prepared,
                        VideoSession.appointment_id.is_(None),
                    ),
                ),
            )
            .first()
        )
        if active_session:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El medico ya tiene una videoconsulta en curso o preparada",
            )

        self._ensure_no_immediate_schedule_conflict(
            db=db,
            doctor_profile_id=doctor_profile.id,
            estimated_minutes=estimated_minutes,
        )

        pricing_service.validate_price_per_minute(doctor_profile.price_per_min_cents)
        prepaid_amount_cents = pricing_service.calculate_prepay_amount(
            doctor_profile.price_per_min_cents,
            estimated_minutes,
        )
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.VIDEO_PREPARE_EXPIRATION_MINUTES)
        room_name = f"sabiodoc-{consultation.id}-{uuid.uuid4().hex[:10]}"

        video_session = VideoSession(
            consultation_id=consultation.id,
            patient_id=patient_id,
            doctor_id=doctor_profile.id,
            provider=VideoProvider.mock_daily if daily_service.is_mock else VideoProvider.daily,
            status=VideoSessionStatus.prepared,
            payment_status=PaymentStatus.pending,
            provider_room_name=room_name,
            doctor_price_per_min_cents=doctor_profile.price_per_min_cents,
            estimated_minutes=estimated_minutes,
            prepaid_amount_cents=prepaid_amount_cents,
            expires_at=expires_at,
        )
        db.add(video_session)
        db.flush()

        try:
            room_data = daily_service.prepare_room(
                room_name=room_name,
                consultation_id=consultation.id,
                doctor_profile_id=doctor_profile.id,
                patient_id=patient_id,
                expires_at=expires_at,
            )
            payment_data = payment_service.create_prepayment(
                amount_cents=prepaid_amount_cents,
                consultation_id=consultation.id,
                doctor_profile_id=doctor_profile.id,
                patient_id=patient_id,
                payment_method_id=payment_method_id,
            )
        except HTTPException:
            raise
        except ValueError as exc:
            video_session.status = VideoSessionStatus.failed
            video_session.payment_status = PaymentStatus.failed
            db.commit()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        except Exception as exc:
            logger.error(f"Video session prepare failed: {exc}", exc_info=True)
            video_session.status = VideoSessionStatus.failed
            video_session.payment_status = PaymentStatus.failed
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No se pudo preparar la videoconsulta con el proveedor externo",
            ) from exc

        video_session.provider = VideoProvider(room_data["provider"])
        video_session.provider_room_url = room_data.get("room_url")
        video_session.payment_reference = payment_data.get("reference")
        video_session.payment_status = PaymentStatus(payment_data["status"])
        video_session.metadata_json = json.dumps(room_data.get("metadata", {}))
        db.add(
            VideoSessionEvent(
                video_session_id=video_session.id,
                event_type="video_session_prepared",
                source="backend",
                payload_json=json.dumps(
                    {
                        "room_name": room_data["room_name"],
                        "payment_reference": payment_data.get("reference"),
                    }
                ),
            )
        )

        doctor_profile.presence.status = DoctorPresenceStatus.busy
        doctor_profile.presence.status_message = "En videoconsulta"
        doctor_profile.presence.last_seen_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(video_session)

        return {
            "video_session_id": video_session.id,
            "status": video_session.status,
            "provider": video_session.provider,
            "payment_status": video_session.payment_status,
            "room_name": room_data["room_name"],
            "room_url": room_data.get("room_url"),
            "patient_token": room_data["patient_token"],
            "doctor_token": room_data["doctor_token"],
            "doctor_price_per_min_cents": video_session.doctor_price_per_min_cents,
            "estimated_minutes": video_session.estimated_minutes,
            "prepaid_amount_cents": video_session.prepaid_amount_cents,
            "expires_at": video_session.expires_at,
            "payment_reference": video_session.payment_reference,
        }

    def prepare_session_for_appointment(
        self,
        db: Session,
        appointment: Appointment,
        current_user: User,
    ) -> dict:
        participant_role = self._resolve_appointment_participant_role(appointment, current_user)
        self._validate_appointment_room_window(appointment)

        doctor_profile = appointment.doctor
        if not doctor_profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medico no encontrado")
        if doctor_profile.status != DoctorApprovalStatus.approved:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El medico aun no esta aprobado")
        if appointment.status != AppointmentStatus.scheduled:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo las citas programadas pueden abrir sala")

        existing_session = (
            db.query(VideoSession)
            .filter(
                VideoSession.appointment_id == appointment.id,
                VideoSession.status.in_([VideoSessionStatus.prepared, VideoSessionStatus.active]),
            )
            .order_by(VideoSession.created_at.desc())
            .first()
        )

        now = datetime.now(timezone.utc)
        if existing_session and existing_session.status == VideoSessionStatus.prepared and existing_session.expires_at <= now:
            existing_session.status = VideoSessionStatus.expired
            existing_session.ended_at = existing_session.ended_at or now
            db.flush()
            existing_session = None

        if existing_session:
            participant_token = daily_service.create_meeting_token(
                room_name=existing_session.provider_room_name,
                owner_id=current_user.id,
                role=participant_role,
                expires_at=existing_session.expires_at,
            )
            db.commit()
            db.refresh(existing_session)
            return self._serialize_appointment_video_session(
                appointment=appointment,
                video_session=existing_session,
                participant_role=participant_role,
                participant_token=participant_token,
            )

        expires_at = self._build_appointment_expiration(appointment)
        room_name = f"sabiodoc-appt-{appointment.id}-{uuid.uuid4().hex[:10]}"

        video_session = VideoSession(
            consultation_id=appointment.consultation_id,
            appointment_id=appointment.id,
            patient_id=appointment.patient_id,
            doctor_id=appointment.doctor_id,
            provider=VideoProvider.mock_daily if daily_service.is_mock else VideoProvider.daily,
            status=VideoSessionStatus.prepared,
            payment_status=PaymentStatus.waived,
            provider_room_name=room_name,
            doctor_price_per_min_cents=doctor_profile.price_per_min_cents,
            estimated_minutes=appointment.duration_minutes,
            prepaid_amount_cents=0,
            expires_at=expires_at,
        )
        db.add(video_session)
        db.flush()

        try:
            room_data = daily_service.prepare_room(
                room_name=room_name,
                consultation_id=appointment.consultation_id,
                appointment_id=appointment.id,
                doctor_profile_id=doctor_profile.id,
                patient_id=appointment.patient_id,
                expires_at=expires_at,
            )
        except Exception as exc:
            logger.error(f"Appointment video session prepare failed: {exc}", exc_info=True)
            video_session.status = VideoSessionStatus.failed
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No se pudo preparar la sala de la cita con el proveedor externo",
            ) from exc

        participant_token = room_data[f"{participant_role}_token"]
        video_session.provider = VideoProvider(room_data["provider"])
        video_session.provider_room_url = room_data.get("room_url")
        video_session.metadata_json = json.dumps(room_data.get("metadata", {}))
        db.add(
            VideoSessionEvent(
                video_session_id=video_session.id,
                event_type="appointment_video_session_prepared",
                source="backend",
                payload_json=json.dumps(
                    {
                        "appointment_id": appointment.id,
                        "room_name": room_data["room_name"],
                    }
                ),
            )
        )
        db.commit()
        db.refresh(video_session)

        return self._serialize_appointment_video_session(
            appointment=appointment,
            video_session=video_session,
            participant_role=participant_role,
            participant_token=participant_token,
        )

    def _resolve_appointment_participant_role(self, appointment: Appointment, current_user: User) -> str:
        if current_user.role == UserRole.admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="El admin no puede entrar a esta sala")
        if appointment.patient_id == current_user.id:
            return "patient"
        if appointment.doctor and appointment.doctor.user_id == current_user.id:
            return "doctor"
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes entrar a esta sala")

    def _validate_appointment_room_window(self, appointment: Appointment) -> None:
        now = datetime.now(timezone.utc)
        opens_at = appointment.scheduled_at - timedelta(minutes=self.APPOINTMENT_ROOM_OPEN_MINUTES_BEFORE)
        closes_at = appointment.scheduled_at + timedelta(
            minutes=appointment.duration_minutes + self.APPOINTMENT_ROOM_CLOSE_MINUTES_AFTER
        )
        if now < opens_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La sala se habilita {self.APPOINTMENT_ROOM_OPEN_MINUTES_BEFORE} minutos antes de la cita",
            )
        if now > closes_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La ventana de acceso a esta videoconsulta ya cerro",
            )

    def _build_appointment_expiration(self, appointment: Appointment) -> datetime:
        now = datetime.now(timezone.utc)
        minimum_expiration = now + timedelta(minutes=settings.VIDEO_PREPARE_EXPIRATION_MINUTES)
        scheduled_expiration = appointment.scheduled_at + timedelta(minutes=appointment.duration_minutes + 60)
        return max(minimum_expiration, scheduled_expiration)

    def _ensure_no_immediate_schedule_conflict(
        self,
        *,
        db: Session,
        doctor_profile_id: int,
        estimated_minutes: int,
    ) -> None:
        now = datetime.now(timezone.utc)
        requested_end = now + timedelta(minutes=estimated_minutes)
        candidate_appointments = (
            db.query(Appointment)
            .filter(
                Appointment.doctor_id == doctor_profile_id,
                Appointment.status == AppointmentStatus.scheduled,
                Appointment.scheduled_at < requested_end,
            )
            .order_by(Appointment.scheduled_at.asc())
            .all()
        )
        for appointment in candidate_appointments:
            appointment_end = appointment.scheduled_at + timedelta(minutes=appointment.duration_minutes)
            if appointment_end > now:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="El medico tiene una cita programada que se cruza con esta videoconsulta inmediata",
                )

    def _serialize_appointment_video_session(
        self,
        *,
        appointment: Appointment,
        video_session: VideoSession,
        participant_role: str,
        participant_token: str,
    ) -> dict:
        return {
            "video_session_id": video_session.id,
            "appointment_id": appointment.id,
            "consultation_id": appointment.consultation_id,
            "status": video_session.status,
            "provider": video_session.provider,
            "room_name": video_session.provider_room_name,
            "room_url": video_session.provider_room_url,
            "participant_token": participant_token,
            "participant_role": participant_role,
            "specialty_name": appointment.specialty.name if appointment.specialty else "Especialidad",
            "doctor_name": appointment.doctor.display_name if appointment.doctor else "Medico",
            "expires_at": video_session.expires_at,
        }


video_session_service = VideoSessionService()
