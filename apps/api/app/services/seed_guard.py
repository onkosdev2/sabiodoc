"""Detección de perfiles de prueba publicados.

El seed crea médicos con correos `*.demo@` y nombres realistas. No basta con
buscar "Test" en el nombre: también revisamos el correo y la marca `is_seed`.
"""

import re

from sqlalchemy.orm import Session

from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.user import User

_SEED_TOKEN = re.compile(r"(^|[.@])(test|demo|qa|example)([.@]|$)", re.IGNORECASE)
_SEED_NAME = re.compile(r"\b(test|demo|qa|example)\b", re.IGNORECASE)


def is_seed_identity(display_name: str | None, email: str | None, is_seed: bool = False) -> bool:
    """True si el perfil parece dato de prueba por marca, nombre o correo."""
    if is_seed:
        return True
    if display_name and _SEED_NAME.search(display_name):
        return True
    if email and _SEED_TOKEN.search(email):
        return True
    return False


def find_published_seed_doctors(db: Session) -> list[DoctorProfile]:
    """Médicos aprobados y publicados que parecen datos de prueba."""
    profiles = (
        db.query(DoctorProfile)
        .join(User, DoctorProfile.user_id == User.id)
        .filter(
            DoctorProfile.status == DoctorApprovalStatus.approved,
            DoctorProfile.is_published == True,
        )
        .all()
    )
    return [
        profile
        for profile in profiles
        if is_seed_identity(
            profile.display_name,
            profile.user.email if profile.user else None,
            bool(profile.is_seed),
        )
    ]
