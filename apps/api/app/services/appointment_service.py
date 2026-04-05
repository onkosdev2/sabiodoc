from collections.abc import Iterable
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.appointment import Appointment, AppointmentStatus
from app.models.chat_message import ChatMessage
from app.models.consultation import Consultation
from app.models.doctor_availability_slot import DoctorAvailabilitySlot
from app.models.doctor_presence import DoctorPresenceStatus
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.doctor_specialty import DoctorSpecialty
from app.models.notification import Notification, NotificationStatus
from app.models.user import User
from app.services.specialist_assistant import specialist_assistant


class AppointmentService:
    def get_no_show_grace_delta(self) -> timedelta:
        return timedelta(minutes=settings.NO_SHOW_GRACE_MINUTES)

    def get_timezone(self, timezone_name: str | None) -> ZoneInfo:
        try:
            return ZoneInfo(timezone_name or "UTC")
        except ZoneInfoNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zona horaria no valida") from exc

    def validate_slots(self, slots: Iterable[DoctorAvailabilitySlot]) -> None:
        for slot in slots:
            if slot.weekday < 0 or slot.weekday > 6:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dia de semana invalido")
            if slot.start_time >= slot.end_time:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cada franja debe tener hora de inicio menor a hora de fin")

    def doctor_supports_specialty(self, doctor_profile: DoctorProfile, specialty_id: int) -> bool:
        return any(link.specialty_id == specialty_id for link in doctor_profile.doctor_specialties)

    def ensure_bookable_doctor(self, doctor_profile: DoctorProfile, specialty_id: int) -> None:
        if doctor_profile.user.role.value != "doctor":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El profesional seleccionado no es medico")
        if doctor_profile.status != DoctorApprovalStatus.approved:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El medico aun no esta aprobado")
        if not doctor_profile.is_accepting_consultations:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El medico no acepta consultas actualmente")
        if not self.doctor_supports_specialty(doctor_profile, specialty_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El medico no atiende esta especialidad")

    def ensure_slot_matches_availability(
        self,
        *,
        doctor_profile: DoctorProfile,
        scheduled_at: datetime,
        duration_minutes: int,
    ) -> None:
        tz = self.get_timezone(doctor_profile.timezone)
        local_start = scheduled_at.astimezone(tz)
        local_end = local_start + timedelta(minutes=duration_minutes)
        weekday = local_start.weekday()

        matches = [
            slot
            for slot in doctor_profile.availability_slots
            if slot.is_active
            and slot.weekday == weekday
            and slot.start_time <= local_start.time()
            and slot.end_time >= local_end.time()
        ]
        if not matches:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La hora elegida no coincide con la disponibilidad del medico")

    def ensure_no_overlap(self, db: Session, *, doctor_id: int, scheduled_at: datetime, duration_minutes: int) -> None:
        buffer_delta = timedelta(minutes=settings.APPOINTMENT_BUFFER_MINUTES)
        requested_end = scheduled_at + timedelta(minutes=duration_minutes)
        protected_start = scheduled_at - buffer_delta
        protected_end = requested_end + buffer_delta
        query_window_start = protected_start - timedelta(minutes=180)
        existing = (
            db.query(Appointment)
            .filter(
                Appointment.doctor_id == doctor_id,
                Appointment.status == AppointmentStatus.scheduled,
                Appointment.scheduled_at >= query_window_start,
                Appointment.scheduled_at < protected_end,
            )
            .all()
        )
        for appointment in existing:
            current_end = appointment.scheduled_at + timedelta(minutes=appointment.duration_minutes)
            current_protected_start = appointment.scheduled_at - buffer_delta
            current_protected_end = current_end + buffer_delta
            if current_protected_start < protected_end and current_protected_end > protected_start:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El medico ya tiene una cita en ese horario")

    def build_ai_summary_snapshot(self, db: Session, consultation: Consultation | None) -> str | None:
        if consultation is None:
            return None
        if consultation.summary:
            return consultation.summary

        messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.consultation_id == consultation.id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
        if len(messages) < 2 or consultation.specialty is None:
            return None

        formatted_messages = [{"role": message.role.value, "content": message.content} for message in messages]
        summary = specialist_assistant.generate_summary(
            specialty_slug=consultation.specialty.slug,
            specialty_name=consultation.specialty.name,
            messages=formatted_messages,
        )
        consultation.summary = summary
        db.flush()
        return summary

    def build_ai_intake_snapshot(self, db: Session, consultation: Consultation | None) -> dict | None:
        if consultation is None:
            return None
        if consultation.intake_json:
            return consultation.intake_json

        messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.consultation_id == consultation.id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
        if len(messages) < 2 or consultation.specialty is None:
            return None

        formatted_messages = [{"role": message.role.value, "content": message.content} for message in messages]
        intake = specialist_assistant.generate_structured_intake(
            specialty_slug=consultation.specialty.slug,
            specialty_name=consultation.specialty.name,
            messages=formatted_messages,
        )
        consultation.intake_json = intake
        db.flush()
        return intake

    def serialize_appointment(self, appointment: Appointment):
        review = appointment.review[0] if appointment.review else None
        from app.schemas.appointment import AppointmentResponse

        return AppointmentResponse(
            id=appointment.id,
            consultation_id=appointment.consultation_id,
            specialty_id=appointment.specialty_id,
            specialty_name=appointment.specialty.name if appointment.specialty else "Especialidad",
            patient_id=appointment.patient_id,
            patient_email=appointment.patient.email if appointment.patient else "",
            doctor_id=appointment.doctor_id,
            doctor_name=appointment.doctor.display_name if appointment.doctor else "Medico",
            status=appointment.status,
            scheduled_at=appointment.scheduled_at,
            duration_minutes=appointment.duration_minutes,
            patient_note=appointment.patient_note,
            ai_summary_snapshot=appointment.ai_summary_snapshot,
            ai_intake_snapshot=appointment.ai_intake_snapshot_json,
            doctor_note=appointment.doctor_note,
            followup_instructions=appointment.followup_instructions,
            cancellation_reason=appointment.cancellation_reason,
            booked_via_ai=appointment.booked_via_ai,
            consent_text_version=appointment.consent_text_version,
            joined_patient_at=appointment.joined_patient_at,
            joined_doctor_at=appointment.joined_doctor_at,
            no_show_marked_at=appointment.no_show_marked_at,
            completed_at=appointment.completed_at,
            cancelled_at=appointment.cancelled_at,
            created_at=appointment.created_at,
            review_rating=review.rating if review else None,
            review_comment=review.comment if review else None,
        )

    def compute_bookable_slots(
        self,
        db: Session,
        *,
        doctor_profile: DoctorProfile,
        days: int,
        duration_minutes: int,
    ) -> list[tuple[datetime, datetime]]:
        tz = self.get_timezone(doctor_profile.timezone)
        now_utc = datetime.now(UTC)
        now_local = now_utc.astimezone(tz)
        end_date = now_local.date() + timedelta(days=days)

        scheduled = (
            db.query(Appointment)
            .filter(
                Appointment.doctor_id == doctor_profile.id,
                Appointment.status == AppointmentStatus.scheduled,
                Appointment.scheduled_at >= now_utc,
                Appointment.scheduled_at < datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=tz).astimezone(UTC),
            )
            .all()
        )

        slots: list[tuple[datetime, datetime]] = []
        current_date = now_local.date()
        while current_date <= end_date:
            for availability in sorted(doctor_profile.availability_slots, key=lambda item: (item.weekday, item.start_time)):
                if not availability.is_active or availability.weekday != current_date.weekday():
                    continue
                local_start = datetime.combine(current_date, availability.start_time, tzinfo=tz)
                local_end = datetime.combine(current_date, availability.end_time, tzinfo=tz)
                cursor = local_start
                while cursor + timedelta(minutes=duration_minutes) <= local_end:
                    candidate_start = cursor.astimezone(UTC)
                    candidate_end = (cursor + timedelta(minutes=duration_minutes)).astimezone(UTC)
                    if candidate_start <= now_utc:
                        cursor += timedelta(minutes=duration_minutes)
                        continue
                    overlap = False
                    for appointment in scheduled:
                        buffer_delta = timedelta(minutes=settings.APPOINTMENT_BUFFER_MINUTES)
                        appointment_end = appointment.scheduled_at + timedelta(minutes=appointment.duration_minutes)
                        protected_start = appointment.scheduled_at - buffer_delta
                        protected_end = appointment_end + buffer_delta
                        if protected_start < candidate_end and protected_end > candidate_start:
                            overlap = True
                            break
                    if not overlap:
                        slots.append((candidate_start, candidate_end))
                    cursor += timedelta(minutes=duration_minutes)
            current_date += timedelta(days=1)

        return slots[:60]

    def unread_notification_count(self, db: Session, user_id: int) -> int:
        return (
            db.query(Notification)
            .filter(Notification.user_id == user_id, Notification.status == NotificationStatus.unread)
            .count()
        )


appointment_service = AppointmentService()
