"""Crea (o limpia) citas de prueba para probar la videollamada.

La sala de una cita programada se habilita desde 60 minutos antes hasta 180
minutos después de la cita, por lo que una cita con hora = ahora es accesible
de inmediato (no hace falta que el médico esté "online").

Uso (desde apps/api):
    ./venv/bin/python scripts/create_test_appointment.py
    ./venv/bin/python scripts/create_test_appointment.py --minutes-ago 0
    ./venv/bin/python scripts/create_test_appointment.py --clean          # borra pruebas previas y crea una nueva
    ./venv/bin/python scripts/create_test_appointment.py --clean-only     # solo borra las pruebas previas
    ./venv/bin/python scripts/create_test_appointment.py \
        --patient paciente.demo@sabiodoc.app --doctor cardio.demo@sabiodoc.app
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Permite ejecutar el script directamente (python scripts/...).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal  # noqa: E402
from app.models.appointment import Appointment, AppointmentStatus  # noqa: E402
from app.models.consultation_review import ConsultationReview  # noqa: E402
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile  # noqa: E402
from app.models.doctor_specialty import DoctorSpecialty  # noqa: E402
from app.models.specialty import Specialty  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.video_session import VideoSession  # noqa: E402
from app.models.video_session_event import VideoSessionEvent  # noqa: E402

ROOM_OPEN_MINUTES_BEFORE = 60
ROOM_CLOSE_MINUTES_AFTER = 180
TEST_NOTE_PREFIX = "[TEST] Cita de prueba (script)"


def clean_test_appointments(db) -> int:
    """Borra las citas de prueba creadas por este script (marcadas con [TEST])."""
    appointments = (
        db.query(Appointment)
        .filter(Appointment.patient_note.like(f"{TEST_NOTE_PREFIX}%"))
        .all()
    )
    deleted = 0
    for appointment in appointments:
        session_ids = [
            row[0]
            for row in db.query(VideoSession.id)
            .filter(VideoSession.appointment_id == appointment.id)
            .all()
        ]
        if session_ids:
            db.query(VideoSessionEvent).filter(
                VideoSessionEvent.video_session_id.in_(session_ids)
            ).delete(synchronize_session=False)
            db.query(VideoSession).filter(
                VideoSession.appointment_id == appointment.id
            ).delete(synchronize_session=False)
        # Las reseñas tienen appointment_id NOT NULL: hay que borrarlas antes que la cita.
        db.query(ConsultationReview).filter(
            ConsultationReview.appointment_id == appointment.id
        ).delete(synchronize_session=False)
        db.delete(appointment)
        deleted += 1
    db.commit()
    return deleted


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Crea una cita de prueba para probar la videollamada.",
    )
    parser.add_argument("--patient", default="paciente.demo@sabiodoc.app", help="Email del paciente")
    parser.add_argument("--doctor", default="cardio.demo@sabiodoc.app", help="Email del médico")
    parser.add_argument(
        "--specialty",
        default=None,
        help="Slug de la especialidad (por defecto, la primera del médico)",
    )
    parser.add_argument(
        "--minutes-ago",
        type=int,
        default=5,
        help="Minutos antes de ahora para agendar la cita (default 5)",
    )
    parser.add_argument("--duration", type=int, default=30, help="Duración en minutos (default 30)")
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Borra las citas de prueba previas y luego crea una nueva",
    )
    parser.add_argument(
        "--clean-only",
        action="store_true",
        help="Solo borra las citas de prueba previas (no crea ninguna)",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.clean or args.clean_only:
            deleted = clean_test_appointments(db)
            print(f"🧹 Citas de prueba eliminadas: {deleted}")

        if args.clean_only:
            return 0

        patient = db.query(User).filter(User.email == args.patient).first()
        if not patient:
            print(f"❌ No existe el paciente {args.patient}")
            return 1

        doctor_user = db.query(User).filter(User.email == args.doctor).first()
        if not doctor_user:
            print(f"❌ No existe el usuario médico {args.doctor}")
            return 1

        doctor = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor_user.id).first()
        if not doctor:
            print(f"❌ {args.doctor} no tiene perfil médico")
            return 1
        if doctor.status != DoctorApprovalStatus.approved:
            print(f"❌ El perfil médico está en estado '{doctor.status.value}' (debe ser 'approved')")
            return 1

        if args.specialty:
            specialty = db.query(Specialty).filter(Specialty.slug == args.specialty).first()
            if not specialty:
                print(f"❌ No existe la especialidad '{args.specialty}'")
                return 1
        else:
            link = db.query(DoctorSpecialty).filter(DoctorSpecialty.doctor_id == doctor.id).first()
            if not link or not link.specialty:
                print("❌ El médico no tiene especialidades asignadas")
                return 1
            specialty = link.specialty

        scheduled_at = datetime.now(timezone.utc) - timedelta(minutes=args.minutes_ago)
        appointment = Appointment(
            specialty_id=specialty.id,
            patient_id=patient.id,
            doctor_id=doctor.id,
            status=AppointmentStatus.scheduled,
            scheduled_at=scheduled_at,
            duration_minutes=args.duration,
            booked_via_ai=False,
            patient_note=TEST_NOTE_PREFIX,
        )
        db.add(appointment)
        db.commit()
        db.refresh(appointment)

        opens_at = scheduled_at - timedelta(minutes=ROOM_OPEN_MINUTES_BEFORE)
        closes_at = scheduled_at + timedelta(minutes=args.duration + ROOM_CLOSE_MINUTES_AFTER)

        print("✅ Cita de prueba creada")
        print(f"   id           : {appointment.id}")
        print(f"   paciente     : {patient.email}")
        print(f"   médico       : {doctor.display_name} ({doctor_user.email})")
        print(f"   especialidad : {specialty.name}")
        print(f"   agendada     : {scheduled_at.isoformat()}")
        print(f"   ventana sala : {opens_at.isoformat()}  ->  {closes_at.isoformat()}")
        print()
        print("→ Entra como paciente a /me/appointments y pulsa 'Entrar a la sala'.")
        print("→ En otro navegador entra como médico y abre la misma sala.")
        print("→ Para borrarla luego: ./venv/bin/python scripts/create_test_appointment.py --clean-only")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
