from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.appointment import Appointment, AppointmentStatus
from app.services.notification_service import notification_service


class ReminderService:
    def process_due_reminders(self, db: Session) -> None:
        now = datetime.now(UTC)
        upcoming = db.query(Appointment).filter(Appointment.status == AppointmentStatus.scheduled).all()

        for appointment in upcoming:
            if appointment.day_reminder_sent_at is None and now <= appointment.scheduled_at <= now + timedelta(hours=24):
                self._send_day_reminder(db, appointment, now)
            if appointment.hour_reminder_sent_at is None and now <= appointment.scheduled_at <= now + timedelta(hours=1):
                self._send_hour_reminder(db, appointment, now)

        review_due = (
            db.query(Appointment)
            .filter(
                Appointment.status == AppointmentStatus.completed,
                Appointment.review_reminder_sent_at.is_(None),
                Appointment.completed_at.is_not(None),
            )
            .all()
        )
        for appointment in review_due:
            if appointment.review:
                appointment.review_reminder_sent_at = now
                continue
            if appointment.completed_at and appointment.completed_at <= now - timedelta(hours=2):
                notification_service.create(
                    db,
                    user_id=appointment.patient_id,
                    notification_type="appointment_review_reminder",
                    title="Cuéntanos cómo te fue en la consulta",
                    body=f"Ya puedes calificar tu cita con {appointment.doctor.display_name}.",
                    action_url="/me/appointments",
                    metadata={"appointment_id": appointment.id, "action_label": "Calificar cita"},
                )
                appointment.review_reminder_sent_at = now

        db.commit()

    def _send_day_reminder(self, db: Session, appointment: Appointment, now: datetime) -> None:
        when = appointment.scheduled_at.strftime("%d/%m %H:%M UTC")
        notification_service.create(
            db,
            user_id=appointment.patient_id,
            notification_type="appointment_reminder_day",
            title="Tu videoconsulta es dentro de 24 horas",
            body=f"Recuerda tu cita con {appointment.doctor.display_name} programada para {when}.",
            action_url="/me/appointments",
            metadata={"appointment_id": appointment.id, "action_label": "Ver cita"},
        )
        notification_service.create(
            db,
            user_id=appointment.doctor.user_id,
            notification_type="appointment_reminder_day",
            title="Tienes una cita dentro de 24 horas",
            body=f"Tienes una videoconsulta con {appointment.patient.email} programada para {when}.",
            action_url="/doctor",
            metadata={"appointment_id": appointment.id, "action_label": "Abrir panel"},
        )
        appointment.day_reminder_sent_at = now

    def _send_hour_reminder(self, db: Session, appointment: Appointment, now: datetime) -> None:
        notification_service.create(
            db,
            user_id=appointment.patient_id,
            notification_type="appointment_reminder_hour",
            title="Tu sala se habilitará pronto",
            body=f"La videoconsulta con {appointment.doctor.display_name} comienza en menos de una hora.",
            action_url="/me/appointments",
            metadata={"appointment_id": appointment.id, "action_label": "Entrar a la sala"},
        )
        notification_service.create(
            db,
            user_id=appointment.doctor.user_id,
            notification_type="appointment_reminder_hour",
            title="Tu próxima videoconsulta comienza pronto",
            body=f"Prepárate para la cita con {appointment.patient.email}.",
            action_url="/doctor",
            metadata={"appointment_id": appointment.id, "action_label": "Abrir panel"},
        )
        appointment.hour_reminder_sent_at = now


reminder_service = ReminderService()
