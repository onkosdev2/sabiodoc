import json
import uuid
from urllib.parse import urlparse
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.logging import get_logger
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.patient_profile import PatientProfile
from app.models.user import User
from app.models.video_session import PaymentStatus, VideoSession, VideoSessionStatus, VideoProvider
from app.models.video_session_event import VideoSessionEvent
from app.models.payment import ConsultationCharge
from app.services.audit_service import audit_service
from app.services.error_log_service import error_log_service
from app.services.jitsi_service import jitsi_service
from app.services.llm_client import llm_client
from app.services.presence_service import resolve_presence

logger = get_logger(__name__)


class VideoSessionService:
    APPOINTMENT_ROOM_OPEN_MINUTES_BEFORE = 60
    APPOINTMENT_ROOM_CLOSE_MINUTES_AFTER = 180

    INTRO_SYSTEM_PROMPT = (
        "Eres un asistente clínico que redacta el guión de apertura de una videoconsulta médica. "
        "El médico leera el texto en voz alta al iniciar la sesión.\n\n"
        "El guión debe cumplir estas reglas:\n"
        "- Ser breve: entre 2 y 4 frases, en espanol neutro, tono profesional y calido.\n"
        "- Presentar al médico por su nombre.\n"
        "- Saludar al paciente por su nombre.\n"
        "- Indicar que la videoconsulta comienza.\n"
        "- Pedir al paciente que diga su nombre completo en voz alta (esto permite identificar "
        "cada voz en la transcripcion de la consulta).\n"
        "- Mencionar que la sesión puede ser transcrita para el historial clínico.\n\n"
        "Devuelve UNICAMENTE el texto que dira el médico: sin comillas, sin acotaciones, sin listas "
        "y sin el nombre del paciente entre corchetes."
    )

    def _resolve_patient_name(self, db: Session, patient: User | None) -> str:
        if patient is None:
            return "paciente"
        profile = db.query(PatientProfile).filter(PatientProfile.user_id == patient.id).first()
        if profile and (profile.first_name or profile.last_name):
            full_name = " ".join(part for part in [profile.first_name, profile.last_name] if part).strip()
            if full_name:
                return full_name
        return patient.email.split("@")[0]

    def _resolve_specialty_name(self, video_session: VideoSession) -> str:
        if video_session.appointment and video_session.appointment.specialty:
            return video_session.appointment.specialty.name
        if video_session.consultation and video_session.consultation.specialty:
            return video_session.consultation.specialty.name
        return "medicina general"

    @staticmethod
    def _intro_fallback(doctor_name: str, patient_name: str, specialty_name: str) -> str:
        return (
            f"Hola, soy {doctor_name}. Te doy la bienvenida a tu videoconsulta de {specialty_name}. "
            f"Antes de comenzar, {patient_name}, ?podrias decir tu nombre completo en voz alta para "
            "confirmar que el audio se registra correctamente? Esta sesión puede ser transcrita para tu "
            "historial clínico. Comenzamos."
        )

    def generate_intro_script(self, db: Session, video_session: VideoSession) -> str:
        """Genera (o devuelve) el guión de apertura de la videoconsulta.

        El guión ayuda a que la transcripcion identifique cada voz y queda guardado
        para no regenerarlo en cada visita.
        """
        if video_session.intro_script:
            return video_session.intro_script

        doctor_name = video_session.doctor.display_name if video_session.doctor else "el médico"
        patient_name = self._resolve_patient_name(db, video_session.patient)
        specialty_name = self._resolve_specialty_name(video_session)

        summary = None
        if video_session.appointment and video_session.appointment.ai_summary_snapshot:
            summary = video_session.appointment.ai_summary_snapshot
        elif video_session.consultation and video_session.consultation.summary:
            summary = video_session.consultation.summary

        user_message = (
            f"Médico: {doctor_name}\n"
            f"Paciente: {patient_name}\n"
            f"Especialidad: {specialty_name}\n"
        )
        if summary:
            user_message += f"Motivo de consulta (resumen previo): {summary[:500]}\n"

        script = llm_client.chat_text(
            messages=[
                {"role": "system", "content": self.INTRO_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.4,
            max_tokens=220,
        )
        script = (script or "").strip().strip('"').strip()
        if not script:
            script = self._intro_fallback(doctor_name, patient_name, specialty_name)

        video_session.intro_script = script
        video_session.intro_generated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(video_session)
        logger.info(f"Video session intro generated: id={video_session.id}")
        return script

    # --- Presencia y facturacion por tiempo real -------------------------

    def _is_presence_fresh(self, last_seen: datetime | None, now: datetime) -> bool:
        if last_seen is None:
            return False
        return (now - last_seen).total_seconds() <= settings.VIDEO_PRESENCE_TIMEOUT_SECONDS

    def set_participant_presence(
        self,
        video_session: VideoSession,
        role: str,
        present: bool,
        now: datetime | None = None,
    ) -> None:
        now = now or datetime.now(timezone.utc)
        if role == "patient":
            video_session.patient_present = present
            video_session.patient_last_seen_at = now
        else:
            video_session.doctor_present = present
            video_session.doctor_last_seen_at = now

    def touch_participant(
        self,
        video_session: VideoSession,
        role: str,
        now: datetime | None = None,
    ) -> None:
        """Heartbeat: actualiza la última senal de vida del participante."""
        now = now or datetime.now(timezone.utc)
        if role == "patient":
            video_session.patient_last_seen_at = now
        else:
            video_session.doctor_last_seen_at = now

    # --- Presencia real en Jitsi -----------------------------------------
    def set_jitsi_presence(
        self,
        video_session: VideoSession,
        role: str,
        present: bool,
        now: datetime | None = None,
    ) -> None:
        """Registra los eventos 'joined'/'left' de la conferencia de Jitsi."""
        now = now or datetime.now(timezone.utc)
        if role == "patient":
            video_session.jitsi_patient_present = present
            if present:
                video_session.jitsi_patient_last_seen_at = now
                if video_session.jitsi_patient_joined_at is None:
                    video_session.jitsi_patient_joined_at = now
        else:
            video_session.jitsi_doctor_present = present
            if present:
                video_session.jitsi_doctor_last_seen_at = now
                if video_session.jitsi_doctor_joined_at is None:
                    video_session.jitsi_doctor_joined_at = now

    def touch_jitsi_participant(
        self,
        video_session: VideoSession,
        role: str,
        now: datetime | None = None,
    ) -> None:
        """Heartbeat emitido desde la conferencia de Jitsi."""
        now = now or datetime.now(timezone.utc)
        if role == "patient":
            video_session.jitsi_patient_present = True
            video_session.jitsi_patient_last_seen_at = now
        else:
            video_session.jitsi_doctor_present = True
            video_session.jitsi_doctor_last_seen_at = now

    def requires_jitsi(self, video_session: VideoSession) -> bool:
        """El cobro por Jitsi solo aplica a salas reales (no al modo mock)."""
        return getattr(video_session, "provider", None) == VideoProvider.jitsi and not jitsi_service.is_mock

    def _is_jitsi_presence_fresh(self, last_seen: datetime | None, now: datetime) -> bool:
        if last_seen is None:
            return True
        return (now - last_seen).total_seconds() <= settings.JITSI_PRESENCE_TIMEOUT_SECONDS

    def participant_in_jitsi(
        self, video_session: VideoSession, role: str, now: datetime | None = None
    ) -> bool:
        now = now or datetime.now(timezone.utc)
        if role == "patient":
            return bool(video_session.jitsi_patient_present) and self._is_jitsi_presence_fresh(
                video_session.jitsi_patient_last_seen_at, now
            )
        return bool(video_session.jitsi_doctor_present) and self._is_jitsi_presence_fresh(
            video_session.jitsi_doctor_last_seen_at, now
        )

    def both_in_jitsi(self, video_session: VideoSession, now: datetime | None = None) -> bool:
        now = now or datetime.now(timezone.utc)
        return self.participant_in_jitsi(video_session, "patient", now) and self.participant_in_jitsi(
            video_session, "doctor", now
        )

    def both_participants_present(self, video_session: VideoSession, now: datetime | None = None) -> bool:
        now = now or datetime.now(timezone.utc)
        if not (
            self.participant_present(video_session, "patient", now)
            and self.participant_present(video_session, "doctor", now)
        ):
            return False
        # Si la sala usa Jitsi real, ambos deben estar además dentro de la
        # conferencia: no se cobra por estar solo en la ruta /video-room.
        if self.requires_jitsi(video_session) and not self.both_in_jitsi(video_session, now):
            return False
        return True

    def participant_present(
        self,
        video_session: VideoSession,
        role: str,
        now: datetime | None = None,
    ) -> bool:
        now = now or datetime.now(timezone.utc)
        if role == "patient":
            return bool(video_session.patient_present) and self._is_presence_fresh(
                video_session.patient_last_seen_at, now
            )
        return bool(video_session.doctor_present) and self._is_presence_fresh(
            video_session.doctor_last_seen_at, now
        )

    def pause_timer(self, video_session: VideoSession, now: datetime | None = None) -> None:
        """Acumula el tiempo transcurrido y detiene el cronómetro."""
        if video_session.started_at is None:
            return
        now = now or datetime.now(timezone.utc)
        segment = max(0, int((now - video_session.started_at).total_seconds()))
        video_session.billable_seconds = (video_session.billable_seconds or 0) + segment
        video_session.started_at = None

    def reconcile_timer(self, video_session: VideoSession, now: datetime | None = None) -> bool:
        """Pausa el cronómetro si dejo de haber ambos participantes en la sala.

        Devuelve True si pauso el cronómetro. Solo acumula el tiempo hasta el
        último momento en que ambos dieron senal de vida, para no cobrar tiempo
        en el que el médico estuvo solo (evita que corra el reloj a su favor).
        """
        if video_session.started_at is None:
            return False
        now = now or datetime.now(timezone.utc)
        if self.both_participants_present(video_session, now):
            return False

        candidates = [now]
        if video_session.patient_last_seen_at is not None:
            candidates.append(video_session.patient_last_seen_at)
        if video_session.doctor_last_seen_at is not None:
            candidates.append(video_session.doctor_last_seen_at)
        break_at = min(candidates)

        segment = max(0, int((break_at - video_session.started_at).total_seconds()))
        video_session.billable_seconds = (video_session.billable_seconds or 0) + segment
        video_session.started_at = None
        logger.info(
            f"Video session {video_session.id} timer paused: participant left the room"
        )
        return True

    def _apply_expiration(self, video_session: VideoSession, now: datetime) -> None:
        """Marca una sesión vencida como expirada, acumulando el tiempo si estaba activa."""
        if video_session.started_at is not None:
            # El tiempo no puede superar la ventana de la sala: evita cobros absurdos
            # si alguien dejo la sesión abierta.
            reference = min(now, video_session.expires_at)
            segment = max(0, int((reference - video_session.started_at).total_seconds()))
            video_session.billable_seconds = (video_session.billable_seconds or 0) + segment
            video_session.started_at = None
        video_session.patient_present = False
        video_session.doctor_present = False
        video_session.status = VideoSessionStatus.expired
        video_session.ended_at = video_session.ended_at or video_session.expires_at
        if not video_session.closed_reason:
            video_session.closed_reason = "expired_inactivity"

    def settle_appointment_if_billable(self, db: Session, video_session: VideoSession) -> None:
        """Finaliza la cita y registra los ingresos si la sesión expiró con uso."""
        appointment = video_session.appointment
        if appointment is None or appointment.status != AppointmentStatus.scheduled:
            return
        if (video_session.billable_seconds or 0) <= 0:
            return

        from app.services.payments.charge_service import charge_service

        charge_service.finalize_session(
            db, video_session, reason=video_session.closed_reason or "session_expired"
        )

    def expire_session_if_stale(self, db: Session, video_session: VideoSession) -> bool:
        now = datetime.now(timezone.utc)
        if video_session.status not in {
            VideoSessionStatus.prepared,
            VideoSessionStatus.active,
            VideoSessionStatus.extension_requested,
        }:
            return False
        if video_session.expires_at > now:
            return False
        self._apply_expiration(video_session, now)
        self.settle_appointment_if_billable(db, video_session)
        db.commit()
        db.refresh(video_session)
        return True

    def _is_abandoned(self, video_session: VideoSession, now: datetime) -> bool:
        """True si una sesión activa lleva un rato sin nadie en la sala."""
        if video_session.status not in {
            VideoSessionStatus.active,
            VideoSessionStatus.extension_requested,
        }:
            return False
        if self.participant_present(video_session, "patient", now) or self.participant_present(
            video_session, "doctor", now
        ):
            return False
        references = [
            value
            for value in (video_session.patient_last_seen_at, video_session.doctor_last_seen_at)
            if value is not None
        ]
        reference = max(references) if references else (video_session.created_at or now)
        return reference <= now - timedelta(minutes=settings.VIDEO_SESSION_ABANDON_MINUTES)

    def _close_abandoned(self, video_session: VideoSession, now: datetime) -> None:
        # Pausa el cronómetro hasta la última senal de vida (si seguia corriendo).
        self.reconcile_timer(video_session, now)
        video_session.patient_present = False
        video_session.doctor_present = False
        video_session.status = VideoSessionStatus.completed
        video_session.ended_at = video_session.ended_at or now
        if not video_session.closed_reason:
            video_session.closed_reason = "auto_closed_inactivity"

    def expire_stale_sessions(self, db: Session, doctor_id: int | None = None) -> int:
        """Expira sesiones vencidas y cierra las abandonadas.

        - Vencidas: la ventana de la sala ya cerro.
        - Abandonadas: siguen `active` pero llevan sin nadie en la sala un rato
          (antes quedaban colgadas hasta vencer).

        En ambos casos se finaliza la cita y se registran los ingresos.
        """
        now = datetime.now(timezone.utc)
        query = db.query(VideoSession).filter(
            VideoSession.status.in_(
                [
                    VideoSessionStatus.prepared,
                    VideoSessionStatus.active,
                    VideoSessionStatus.extension_requested,
                ]
            ),
            VideoSession.expires_at <= now,
        )
        if doctor_id is not None:
            query = query.filter(VideoSession.doctor_id == doctor_id)
        stale = list(query.all())

        abandoned_query = db.query(VideoSession).filter(
            VideoSession.status.in_(
                [VideoSessionStatus.active, VideoSessionStatus.extension_requested]
            ),
            VideoSession.expires_at > now,
        )
        if doctor_id is not None:
            abandoned_query = abandoned_query.filter(VideoSession.doctor_id == doctor_id)
        abandoned = [session for session in abandoned_query.all() if self._is_abandoned(session, now)]

        if not stale and not abandoned:
            return 0

        for video_session in stale:
            self._apply_expiration(video_session, now)
            self.settle_appointment_if_billable(db, video_session)

        for video_session in abandoned:
            self._close_abandoned(video_session, now)
            self.settle_appointment_if_billable(db, video_session)
            db.add(
                VideoSessionEvent(
                    video_session_id=video_session.id,
                    event_type="video_session_auto_closed",
                    source="backend",
                    payload_json=json.dumps({"reason": "inactivity"}),
                )
            )

        db.commit()
        total = len(stale) + len(abandoned)
        logger.info(f"Closed {total} stale video session(s) (doctor_id={doctor_id})")
        return total

    def sync_doctor_presence(self, db: Session, doctor_profile_id: int) -> None:
        """Persiste la presencia derivada (para mantenerla fresca tras eventos)."""
        doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_profile_id).first()
        if not doctor_profile or not doctor_profile.presence:
            return
        resolved = resolve_presence(db, doctor_profile)
        presence = doctor_profile.presence
        if presence.status != resolved.status or presence.status_message != resolved.status_message:
            presence.status = resolved.status
            presence.status_message = resolved.status_message
            db.commit()

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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Médico no encontrado")
        if doctor_profile.status != DoctorApprovalStatus.approved:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El médico aún no está aprobado")
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
        if existing_session:
            current_host = (urlparse(settings.JITSI_BASE_URL).hostname or "").lower()
            existing_host = (urlparse(existing_session.provider_room_url or "").hostname or "").lower()
            if current_host and existing_host and current_host != existing_host:
                # El host de Jitsi cambió (p. ej. de meet.jit.si a uno self-hosted).
                existing_session.status = VideoSessionStatus.expired
                existing_session.ended_at = existing_session.ended_at or now
                db.flush()
                existing_session = None
        if existing_session and existing_session.status == VideoSessionStatus.prepared and existing_session.expires_at <= now:
            existing_session.status = VideoSessionStatus.expired
            existing_session.ended_at = existing_session.ended_at or now
            db.flush()
            existing_session = None

        if existing_session:
            if participant_role == "patient":
                participant_name = self._resolve_patient_name(db, appointment.patient)
                participant_email = appointment.patient.email if appointment.patient else None
            else:
                participant_name = doctor_profile.display_name
                participant_email = doctor_profile.user.email if doctor_profile.user else None
            participant_token = jitsi_service.create_meeting_token(
                room_name=existing_session.provider_room_name,
                owner_id=current_user.id,
                role=participant_role,
                expires_at=existing_session.expires_at,
                name=participant_name,
                email=participant_email,
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

        charge = (
            db.query(ConsultationCharge)
            .filter(ConsultationCharge.appointment_id == appointment.id)
            .first()
        )
        session_payment_status = PaymentStatus.pending
        payment_amount_cents = charge.quoted_amount_cents if charge else 0

        video_session = VideoSession(
            consultation_id=appointment.consultation_id,
            appointment_id=appointment.id,
            patient_id=appointment.patient_id,
            doctor_id=appointment.doctor_id,
            provider=VideoProvider.jitsi_mock if jitsi_service.is_mock else VideoProvider.jitsi,
            status=VideoSessionStatus.prepared,
            payment_status=session_payment_status,
            provider_room_name=room_name,
            doctor_price_per_min_cents=doctor_profile.price_per_min_cents,
            estimated_minutes=appointment.duration_minutes,
            payment_amount_cents=payment_amount_cents,
            expires_at=expires_at,
        )
        db.add(video_session)
        db.flush()

        try:
            room_data = jitsi_service.prepare_room(
                room_name=room_name,
                consultation_id=appointment.consultation_id,
                appointment_id=appointment.id,
                doctor_profile_id=doctor_profile.id,
                patient_id=appointment.patient_id,
                expires_at=expires_at,
                patient_name=self._resolve_patient_name(db, appointment.patient),
                patient_email=appointment.patient.email if appointment.patient else None,
                doctor_name=doctor_profile.display_name,
                doctor_email=doctor_profile.user.email if doctor_profile.user else None,
            )
        except Exception as exc:
            logger.error(f"Appointment video session prepare failed: {exc}", exc_info=True)
            error_log_service.record_exception(
                exc,
                message=f"Fallo al preparar la sala de la cita: {exc}",
                video_session_id=video_session.id,
                appointment_id=appointment.id,
                consultation_id=appointment.consultation_id,
                context={
                    "flow": "prepare_session_for_appointment",
                    "jitsi_mock": jitsi_service.is_mock,
                    "jitsi_base_url": settings.JITSI_BASE_URL,
                    "jitsi_jwt_enabled": bool(settings.JITSI_JWT_SECRET),
                    "room_name": room_name,
                },
            )
            video_session.status = VideoSessionStatus.failed
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No se pudo preparar la sala de la cita con el proveedor externo",
            ) from exc

        participant_token = room_data[f"{participant_role}_token"]
        video_session.provider = VideoProvider(room_data["provider"])
        video_session.provider_room_name = room_data["room_name"]
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
        # Primero resolvemos si el usuario es participante real de la cita, sin
        # importar su rol principal. Asi un médico/admin que también agenda como
        # paciente puede entrar a su propia consulta.
        if appointment.patient_id == current_user.id:
            return "patient"
        if appointment.doctor and appointment.doctor.user_id == current_user.id:
            return "doctor"
        if current_user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="El administrador no puede entrar a esta sala")
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
                    detail="El médico tiene una cita programada que se cruza con esta videoconsulta inmediata",
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
            "room_url": jitsi_service.build_participant_url(video_session.provider_room_name, participant_token),
            "participant_token": participant_token,
            "participant_role": participant_role,
            "specialty_name": appointment.specialty.name if appointment.specialty else "Especialidad",
            "doctor_name": appointment.doctor.display_name if appointment.doctor else "Médico",
            "expires_at": video_session.expires_at,
        }


video_session_service = VideoSessionService()
