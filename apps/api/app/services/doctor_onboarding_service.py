from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.doctor_presence import DoctorPresence, DoctorPresenceStatus
from app.models.doctor_profile import DoctorProfile
from app.models.doctor_specialty import DoctorSpecialty
from app.models.specialty import Specialty
from app.schemas.doctor import DoctorApplicationResponse, DoctorSpecialtySummary
from app.services.pricing_service import pricing_service


class DoctorOnboardingService:
    def validate_price_or_raise(self, price_per_min_cents: int) -> None:
        try:
            pricing_service.validate_price_per_minute(price_per_min_cents)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    def resolve_specialties(self, db: Session, specialty_ids: list[int]) -> list[Specialty]:
        unique_ids = list(dict.fromkeys(specialty_ids))
        specialties = db.query(Specialty).filter(Specialty.id.in_(unique_ids)).order_by(Specialty.name.asc()).all()
        if len(specialties) != len(unique_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Una o mas especialidades no existen",
            )
        return specialties

    def sync_specialties(self, db: Session, doctor_profile: DoctorProfile, specialty_ids: list[int]) -> list[Specialty]:
        specialties = self.resolve_specialties(db, specialty_ids)
        db.query(DoctorSpecialty).filter(DoctorSpecialty.doctor_id == doctor_profile.id).delete()
        db.flush()
        for specialty in specialties:
            db.add(DoctorSpecialty(doctor_id=doctor_profile.id, specialty_id=specialty.id))
        return specialties

    def ensure_presence(self, db: Session, doctor_profile: DoctorProfile) -> DoctorPresence:
        presence = doctor_profile.presence
        if not presence:
            presence = DoctorPresence(
                doctor_id=doctor_profile.id,
                status=DoctorPresenceStatus.offline,
                status_message="Desconectado",
            )
            db.add(presence)
            db.flush()
        return presence

    def build_application_response(self, doctor_profile: DoctorProfile, specialties: list[Specialty]) -> DoctorApplicationResponse:
        return DoctorApplicationResponse(
            doctor_id=doctor_profile.id,
            user_id=doctor_profile.user_id,
            email=doctor_profile.user.email,
            display_name=doctor_profile.display_name,
            professional_title=doctor_profile.professional_title,
            bio_short=doctor_profile.bio_short,
            price_per_min_cents=doctor_profile.price_per_min_cents,
            license_number=doctor_profile.license_number,
            license_country=doctor_profile.license_country,
            country=doctor_profile.country,
            city=doctor_profile.city,
            timezone=doctor_profile.timezone,
            government_id=doctor_profile.government_id,
            years_experience=doctor_profile.years_experience,
            is_accepting_consultations=doctor_profile.is_accepting_consultations,
            status=doctor_profile.status,
            review_notes=doctor_profile.review_notes,
            specialties=[
                DoctorSpecialtySummary(id=specialty.id, slug=specialty.slug, name=specialty.name)
                for specialty in specialties
            ],
            created_at=doctor_profile.created_at,
            updated_at=doctor_profile.updated_at,
        )

    def build_application_response_from_relations(self, doctor_profile: DoctorProfile) -> DoctorApplicationResponse:
        specialties = sorted(
            (link.specialty for link in doctor_profile.doctor_specialties if link.specialty),
            key=lambda specialty: specialty.name.lower(),
        )
        return self.build_application_response(doctor_profile, specialties)


doctor_onboarding_service = DoctorOnboardingService()
