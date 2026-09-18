import sys
import os
from datetime import datetime, timedelta, time, timezone

from sqlalchemy import func

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.appointment import Appointment, AppointmentStatus
from app.models.consultation_review import ConsultationReview
from app.models.user import User, UserRole
from app.models.specialty import Specialty
from app.models.doctor_profile import DoctorProfile
from app.models.doctor_profile import DoctorApprovalStatus
from app.models.doctor_availability_slot import DoctorAvailabilitySlot
from app.models.doctor_specialty import DoctorSpecialty
from app.models.doctor_presence import DoctorPresence, DoctorPresenceStatus
from app.models.video_session_event import VideoSessionEvent
from app.models.video_session import VideoSession
from app.seed.specialties_data import SPECIALTIES_DATA
from app.seed.doctors_data import DOCTORS_DATA


def seed_demo_admin():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin.demo@sabiodoc.app").first()
        if not admin:
            admin = User(
                email="admin.demo@sabiodoc.app",
                password_hash=get_password_hash("AdminDemo123!"),
                role=UserRole.admin,
            )
            db.add(admin)
            db.commit()
            print("✅ Admin demo listo: admin.demo@sabiodoc.app / AdminDemo123!")
        else:
            print("Admin demo ya existe. Saltando seed.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error al insertar admin demo: {e}")
        raise
    finally:
        db.close()

def seed_demo_patient():
    db = SessionLocal()
    try:
        patient_email = "paciente.demo@sabiodoc.app"
        patient = db.query(User).filter(User.email == patient_email).first()
        if not patient:
            patient = User(
                email=patient_email,
                password_hash=get_password_hash("PatientDemo123!"),
                role=UserRole.patient,  # O el rol que corresponda a usuario normal
            )
            db.add(patient)
            db.commit()
            print(f"✅ Paciente demo listo: {patient_email} / PatientDemo123!")
        else:
            print("Paciente demo ya existe. Saltando seed.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error al insertar paciente demo: {e}")
        raise
    finally:
        db.close()


def seed_demo_reviewer():
    db = SessionLocal()
    try:
        reviewer_email = "revisor.demo@sabiodoc.app"
        reviewer = db.query(User).filter(User.email == reviewer_email).first()
        if not reviewer:
            reviewer = User(
                email=reviewer_email,
                password_hash=get_password_hash("ReviewerDemo123!"),
                role=UserRole.reviewer,
            )
            db.add(reviewer)
            db.commit()
            print("✅ Revisor demo listo: revisor.demo@sabiodoc.app / ReviewerDemo123!")
        else:
            print("Revisor demo ya existe. Saltando seed.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error al insertar revisor demo: {e}")
        raise
    finally:
        db.close()


def seed_specialties():
    db = SessionLocal()
    try:
        existing_count = db.query(Specialty).count()
        if existing_count > 0:
            print(f"Ya existen {existing_count} especialidades. Saltando seed.")
            return
        
        for data in SPECIALTIES_DATA:
            specialty = Specialty(
                slug=data["slug"],
                name=data["name"],
                description=data["description"],
                keywords=data["keywords"],
                is_top=data["is_top"]
            )
            db.add(specialty)
        
        db.commit()
        print(f"✅ Se insertaron {len(SPECIALTIES_DATA)} especialidades correctamente.")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error al insertar especialidades: {e}")
        raise
    finally:
        db.close()


def seed_demo_doctors():
    db = SessionLocal()
    try:
        legacy_users = db.query(User).filter(User.email.like("%@sabiodoc.local")).all()
        for user in legacy_users:
            profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
            if profile:
                session_ids = [row[0] for row in db.query(VideoSession.id).filter(VideoSession.doctor_id == profile.id).all()]
                if session_ids:
                    db.query(VideoSessionEvent).filter(VideoSessionEvent.video_session_id.in_(session_ids)).delete(synchronize_session=False)
                db.query(VideoSession).filter(VideoSession.doctor_id == profile.id).delete(synchronize_session=False)
                db.query(DoctorSpecialty).filter(DoctorSpecialty.doctor_id == profile.id).delete(synchronize_session=False)
                db.query(DoctorPresence).filter(DoctorPresence.doctor_id == profile.id).delete(synchronize_session=False)
                db.delete(profile)
            db.delete(user)
        db.flush()

        inserted = 0
        for doctor_data in DOCTORS_DATA:
            user = db.query(User).filter(User.email == doctor_data["email"]).first()
            if not user:
                user = User(
                    email=doctor_data["email"],
                    password_hash=get_password_hash(doctor_data["password"]),
                    role=UserRole.doctor,
                )
                db.add(user)
                db.flush()

            profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
            if not profile:
                profile = DoctorProfile(
                    user_id=user.id,
                    display_name=doctor_data["display_name"],
                    bio_short=doctor_data["bio_short"],
                    price_per_min_cents=doctor_data["price_per_min_cents"],
                )
                db.add(profile)
                db.flush()

            profile.display_name = doctor_data["display_name"]
            profile.professional_title = doctor_data["professional_title"]
            profile.bio_short = doctor_data["bio_short"]
            profile.price_per_min_cents = doctor_data["price_per_min_cents"]
            profile.license_number = doctor_data["license_number"]
            profile.license_country = doctor_data["license_country"]
            profile.country = doctor_data["country"]
            profile.city = doctor_data["city"]
            profile.timezone = doctor_data["timezone"]
            profile.government_id = doctor_data["government_id"]
            profile.years_experience = doctor_data["years_experience"]
            profile.is_accepting_consultations = True
            profile.status = DoctorApprovalStatus(doctor_data["status"])
            profile.review_notes = None

            db.query(DoctorSpecialty).filter(DoctorSpecialty.doctor_id == profile.id).delete()
            db.query(DoctorAvailabilitySlot).filter(DoctorAvailabilitySlot.doctor_id == profile.id).delete()
            specialties = (
                db.query(Specialty)
                .filter(Specialty.slug.in_(doctor_data["specialty_slugs"]))
                .all()
            )
            for specialty in specialties:
                db.add(DoctorSpecialty(doctor_id=profile.id, specialty_id=specialty.id))
            for slot in doctor_data["availability_slots"]:
                start_hour, start_minute = map(int, slot["start"].split(":"))
                end_hour, end_minute = map(int, slot["end"].split(":"))
                db.add(
                    DoctorAvailabilitySlot(
                        doctor_id=profile.id,
                        weekday=slot["weekday"],
                        start_time=time(start_hour, start_minute),
                        end_time=time(end_hour, end_minute),
                        is_active=True,
                    )
                )

            presence = db.query(DoctorPresence).filter(DoctorPresence.doctor_id == profile.id).first()
            if not presence:
                presence = DoctorPresence(doctor_id=profile.id)
                db.add(presence)

            # La presencia es real: se deriva de la ultima actividad y de las
            # sesiones. En el seed los medicos demo no estan usando la app, por
            # eso aparecen "Desconectado" hasta que inicien sesion (heartbeat).
            presence.last_seen_at = datetime.now(timezone.utc) - timedelta(hours=1)
            presence.status = DoctorPresenceStatus.offline
            presence.status_message = "Desconectado"
            inserted += 1

        db.commit()
        print(f"✅ Se actualizaron {inserted} perfiles medicos demo.")
        print("Credenciales demo: cardio.demo@sabiodoc.app / DemoDoctor123!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error al insertar medicos demo: {e}")
        raise
    finally:
        db.close()


REVIEW_TEMPLATES = [
    (5, "Excelente atención, explicó todo con mucha claridad y paciencia."),
    (5, "Muy puntual y amable. La videoconsulta fue fluida y resolvió mis dudas."),
    (4, "Buen diagnóstico y seguimiento. Dio recomendaciones útiles para mi tratamiento."),
]


def seed_demo_reviews():
    """Crea resenas de ejemplo para los medicos demo (con citas completadas)."""
    db = SessionLocal()
    try:
        if db.query(ConsultationReview).count() > 0:
            print("Ya existen resenas. Saltando seed de resenas.")
            return

        patients = db.query(User).filter(User.role == UserRole.patient).order_by(User.id).all()
        if not patients:
            print("No hay pacientes para sembrar resenas.")
            return

        doctors = (
            db.query(DoctorProfile)
            .filter(DoctorProfile.status == DoctorApprovalStatus.approved)
            .order_by(DoctorProfile.id)
            .limit(8)
            .all()
        )

        now = datetime.now(timezone.utc)
        created = 0
        patient_index = 0

        for doctor in doctors:
            specialties = sorted(
                (link.specialty for link in doctor.doctor_specialties if link.specialty),
                key=lambda specialty: specialty.name.lower(),
            )
            if not specialties:
                continue
            specialty = specialties[0]

            for offset, (rating, comment) in enumerate(REVIEW_TEMPLATES):
                patient = patients[patient_index % len(patients)]
                patient_index += 1

                completed_at = now - timedelta(days=12 + offset * 4, hours=doctor.id % 6)
                appointment = Appointment(
                    specialty_id=specialty.id,
                    patient_id=patient.id,
                    doctor_id=doctor.id,
                    status=AppointmentStatus.completed,
                    scheduled_at=completed_at - timedelta(minutes=30),
                    duration_minutes=30,
                    completed_at=completed_at,
                    consent_accepted_at=completed_at - timedelta(minutes=30),
                    consent_text_version="v1",
                )
                db.add(appointment)
                db.flush()

                db.add(
                    ConsultationReview(
                        appointment_id=appointment.id,
                        patient_id=patient.id,
                        doctor_id=doctor.id,
                        rating=rating,
                        comment=comment,
                        created_at=completed_at + timedelta(hours=2),
                    )
                )
                created += 1

        # Recalculamos el promedio y la cantidad reales desde consultation_reviews
        # para todos los medicos (no se usan valores en duro).
        db.flush()
        rows = (
            db.query(
                ConsultationReview.doctor_id,
                func.avg(ConsultationReview.rating),
                func.count(ConsultationReview.id),
            )
            .group_by(ConsultationReview.doctor_id)
            .all()
        )
        aggregates = {
            doctor_id: (round(float(average or 0), 2), int(total or 0))
            for doctor_id, average, total in rows
        }
        for doctor in db.query(DoctorProfile).all():
            average, total = aggregates.get(doctor.id, (0.0, 0))
            doctor.rating_avg = average
            doctor.rating_count = total

        db.commit()
        print(f"✅ Se crearon {created} resenas demo para {len(doctors)} medicos.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error al sembrar resenas demo: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_specialties()
    seed_demo_admin()
    seed_demo_reviewer()
    seed_demo_doctors()
    seed_demo_patient()
    seed_demo_reviews()
