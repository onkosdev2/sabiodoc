import sys
import os
from datetime import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db.session import SessionLocal
from app.core.security import get_password_hash
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
            profile.rating_avg = doctor_data["rating_avg"]
            profile.rating_count = doctor_data["rating_count"]
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

            presence.status = DoctorPresenceStatus(doctor_data["presence_status"])
            presence.status_message = doctor_data["presence_message"]
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


if __name__ == "__main__":
    seed_specialties()
    seed_demo_admin()
    seed_demo_doctors()
