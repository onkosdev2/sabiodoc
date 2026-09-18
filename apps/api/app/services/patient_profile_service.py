from datetime import date

from app.models.patient_profile import PatientProfile
from app.models.user import User
from app.schemas.patient import PatientProfileResponse

SEX_LABELS = {"male": "masculino", "female": "femenino", "other": "otro"}


def get_patient_display_name(patient: User | None) -> str | None:
    """Nombre del paciente desde su perfil (nombres + apellidos), si existe."""
    if patient is None:
        return None
    profile = getattr(patient, "patient_profile", None)
    if profile and (profile.first_name or profile.last_name):
        full_name = " ".join(part for part in [profile.first_name, profile.last_name] if part).strip()
        return full_name or None
    return None


def compute_age(date_of_birth: date | None) -> int | None:
    if not date_of_birth:
        return None
    today = date.today()
    return (
        today.year
        - date_of_birth.year
        - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))
    )


def serialize_patient_profile(profile: PatientProfile | None, user: User) -> PatientProfileResponse:
    full_name = None
    if profile and (profile.first_name or profile.last_name):
        full_name = " ".join(part for part in [profile.first_name, profile.last_name] if part).strip()

    return PatientProfileResponse(
        id=profile.id if profile else None,
        user_id=user.id,
        email=user.email,
        first_name=profile.first_name if profile else None,
        last_name=profile.last_name if profile else None,
        date_of_birth=profile.date_of_birth if profile else None,
        sex=profile.sex if profile else None,
        phone=profile.phone if profile else None,
        country=profile.country if profile else None,
        city=profile.city if profile else None,
        timezone=profile.timezone if profile else None,
        blood_type=profile.blood_type if profile else None,
        allergies=profile.allergies if profile else None,
        chronic_conditions=profile.chronic_conditions if profile else None,
        current_medications=profile.current_medications if profile else None,
        family_history=profile.family_history if profile else None,
        height_cm=profile.height_cm if profile else None,
        weight_kg=profile.weight_kg if profile else None,
        smoker=profile.smoker if profile else None,
        alcohol=profile.alcohol if profile else None,
        emergency_contact_name=profile.emergency_contact_name if profile else None,
        emergency_contact_phone=profile.emergency_contact_phone if profile else None,
        notes=profile.notes if profile else None,
        full_name=full_name,
        age=compute_age(profile.date_of_birth) if profile else None,
        created_at=profile.created_at if profile else None,
        updated_at=profile.updated_at if profile else None,
    )


def build_patient_context(profile: PatientProfile | None, email: str) -> str | None:
    """Resumen en texto del perfil para dar contexto a la IA.

    Devuelve ``None`` si el paciente no tiene datos útiles.
    """
    if not profile:
        return None

    lines: list[str] = []
    name = " ".join(part for part in [profile.first_name, profile.last_name] if part).strip()
    if name:
        lines.append(f"Nombre: {name}")
    age = compute_age(profile.date_of_birth)
    if age is not None:
        lines.append(f"Edad: {age} años")
    if profile.sex:
        lines.append(f"Sexo: {SEX_LABELS.get(profile.sex.value, profile.sex.value)}")
    if profile.blood_type:
        lines.append(f"Grupo sanguíneo: {profile.blood_type}")
    if profile.allergies:
        lines.append(f"Alergias: {profile.allergies}")
    if profile.chronic_conditions:
        lines.append(f"Enfermedades crónicas: {profile.chronic_conditions}")
    if profile.current_medications:
        lines.append(f"Medicación actual: {profile.current_medications}")
    if profile.family_history:
        lines.append(f"Antecedentes familiares: {profile.family_history}")
    if profile.height_cm:
        lines.append(f"Altura: {profile.height_cm} cm")
    if profile.weight_kg:
        lines.append(f"Peso: {profile.weight_kg} kg")
    if profile.smoker is not None:
        lines.append(f"Fumador: {'sí' if profile.smoker else 'no'}")
    if profile.alcohol is not None:
        lines.append(f"Consumo de alcohol: {'sí' if profile.alcohol else 'no'}")
    if profile.notes:
        lines.append(f"Notas: {profile.notes}")

    if not lines:
        return None

    lines.insert(0, f"Perfil del paciente ({email}):")
    return "\n".join(lines)
