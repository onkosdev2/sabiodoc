"""Lógica de propuestas de cambio sobre el perfil del paciente.

Flujo:
1. Un médico propone valores nuevos para algunos campos del perfil.
2. Guardamos el diff (valor anterior -> valor propuesto) en una solicitud.
3. El paciente la aprueba (se aplican los cambios) o la rechaza.

Las funciones puras (``profile_to_snapshot``, ``build_diff``) se mantienen sin
acceso a base de datos para poder probarlas de forma aislada.
"""

import enum
import json
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.doctor_profile import DoctorProfile
from app.models.patient_profile import PatientProfile
from app.models.patient_profile_change_request import (
    PatientProfileChangeRequest,
    PatientProfileChangeStatus,
)
from app.models.user import User
from app.schemas.patient import PatientProfileUpsert
from app.schemas.patient_profile_change import (
    PatientProfileChangeRequestCreate,
    PatientProfileChangeRequestResponse,
)
from app.services.patient_profile_service import get_patient_display_name

# Campos que un médico puede proponer modificar.
EDITABLE_FIELDS: tuple[str, ...] = tuple(PatientProfileUpsert.model_fields.keys())


def _normalize(value: Any) -> Any:
    """Normaliza valores para comparar sin falsos positivos ("" == None, trim)."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned or None
    return value


def profile_to_snapshot(profile: PatientProfile | None) -> dict[str, Any]:
    """Snapshot JSON-serializable de los campos editables del perfil."""
    if profile is None:
        return {field: None for field in EDITABLE_FIELDS}

    snapshot: dict[str, Any] = {}
    for field in EDITABLE_FIELDS:
        value = getattr(profile, field, None)
        if isinstance(value, enum.Enum):
            value = value.value
        elif isinstance(value, (date, datetime)):
            value = value.isoformat()
        snapshot[field] = value
    return snapshot


def build_diff(current: dict[str, Any], proposed: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Diff de campos presentes en ``proposed`` que difieren del estado actual."""
    diff: dict[str, dict[str, Any]] = {}
    for field, new_value in proposed.items():
        if field not in EDITABLE_FIELDS:
            continue
        old_value = current.get(field)
        if _normalize(old_value) != _normalize(new_value):
            diff[field] = {"from": old_value, "to": new_value}
    return diff


def create_change_request(
    db: Session,
    *,
    patient: User,
    doctor_profile: DoctorProfile,
    payload: PatientProfileChangeRequestCreate,
) -> PatientProfileChangeRequest:
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == patient.id).first()
    current = profile_to_snapshot(profile)
    proposed = payload.model_dump(mode="json", exclude_unset=True, exclude={"doctor_message"})
    diff = build_diff(current, proposed)
    if not diff:
        raise ValueError("No hay cambios que proponer: los datos enviados son iguales a los actuales.")

    request = PatientProfileChangeRequest(
        patient_id=patient.id,
        doctor_profile_id=doctor_profile.id,
        status=PatientProfileChangeStatus.pending,
        proposed_changes=json.dumps(diff, ensure_ascii=True),
        current_snapshot=json.dumps(current, ensure_ascii=True),
        doctor_message=payload.doctor_message,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


def apply_change_request(db: Session, request: PatientProfileChangeRequest) -> None:
    """Aplica al perfil los cambios aprobados."""
    diff = json.loads(request.proposed_changes or "{}")
    to_apply = {
        field: change.get("to")
        for field, change in diff.items()
        if field in EDITABLE_FIELDS and isinstance(change, dict)
    }

    profile = db.query(PatientProfile).filter(PatientProfile.user_id == request.patient_id).first()
    if not profile:
        profile = PatientProfile(user_id=request.patient_id)
        db.add(profile)

    payload = PatientProfileUpsert.model_validate(to_apply)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)


def resolve_change_request(
    db: Session,
    *,
    request: PatientProfileChangeRequest,
    action: str,
    patient_note: str | None,
) -> PatientProfileChangeRequest:
    if request.status != PatientProfileChangeStatus.pending:
        raise ValueError("La solicitud ya fue resuelta.")

    if action == "approve":
        apply_change_request(db, request)
        request.status = PatientProfileChangeStatus.approved
    else:
        request.status = PatientProfileChangeStatus.rejected

    request.patient_note = patient_note
    request.resolved_at = datetime.now(UTC)
    db.commit()
    db.refresh(request)
    return request


def list_pending_for_patient(
    db: Session, patient_id: int
) -> list[PatientProfileChangeRequest]:
    return (
        db.query(PatientProfileChangeRequest)
        .filter(
            PatientProfileChangeRequest.patient_id == patient_id,
            PatientProfileChangeRequest.status == PatientProfileChangeStatus.pending,
        )
        .order_by(PatientProfileChangeRequest.created_at.desc())
        .all()
    )


def list_for_patient_and_doctor(
    db: Session, *, patient_id: int, doctor_profile_id: int, limit: int = 10
) -> list[PatientProfileChangeRequest]:
    return (
        db.query(PatientProfileChangeRequest)
        .filter(
            PatientProfileChangeRequest.patient_id == patient_id,
            PatientProfileChangeRequest.doctor_profile_id == doctor_profile_id,
        )
        .order_by(PatientProfileChangeRequest.created_at.desc())
        .limit(limit)
        .all()
    )


def serialize_change_request(
    db: Session, request: PatientProfileChangeRequest
) -> PatientProfileChangeRequestResponse:
    patient = db.query(User).filter(User.id == request.patient_id).first()
    doctor_profile = (
        db.query(DoctorProfile).filter(DoctorProfile.id == request.doctor_profile_id).first()
    )

    try:
        proposed_changes = json.loads(request.proposed_changes or "{}")
    except json.JSONDecodeError:
        proposed_changes = {}
    try:
        current_snapshot = json.loads(request.current_snapshot or "{}")
    except json.JSONDecodeError:
        current_snapshot = {}

    return PatientProfileChangeRequestResponse(
        id=request.id,
        patient_id=request.patient_id,
        patient_email=patient.email if patient else None,
        patient_name=get_patient_display_name(patient),
        doctor_id=doctor_profile.id if doctor_profile else None,
        doctor_name=doctor_profile.display_name if doctor_profile else None,
        status=request.status,
        proposed_changes=proposed_changes,
        current_snapshot=current_snapshot,
        doctor_message=request.doctor_message,
        patient_note=request.patient_note,
        created_at=request.created_at,
        resolved_at=request.resolved_at,
    )
