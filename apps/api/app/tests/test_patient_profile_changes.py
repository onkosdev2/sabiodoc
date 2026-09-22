"""Propuestas de cambio del perfil del paciente (médico -> paciente aprueba)."""

import json
import uuid

from datetime import date

from app.db.session import SessionLocal
from app.models.doctor_profile import DoctorProfile
from app.models.patient_profile import PatientProfile
from app.models.patient_profile_change_request import (
    PatientProfileChangeRequest,
    PatientProfileChangeStatus,
)
from app.models.user import User, UserRole
from app.schemas.patient_profile_change import PatientProfileChangeRequestCreate
from app.services.patient_profile_change_service import (
    build_diff,
    create_change_request,
    profile_to_snapshot,
    resolve_change_request,
)


def test_build_diff_ignores_unchanged_and_whitespace():
    current = {"first_name": None, "allergies": "Penicilina", "height_cm": 170, "smoker": False}
    proposed = {
        "first_name": "Ana",
        "allergies": "  Penicilina ",
        "height_cm": 171,
        "smoker": False,
    }
    diff = build_diff(current, proposed)
    assert diff == {
        "first_name": {"from": None, "to": "Ana"},
        "height_cm": {"from": 170, "to": 171},
    }


def test_profile_to_snapshot_serializes_enum_and_date():
    from app.models.patient_profile import PatientSex

    profile = PatientProfile(
        user_id=1,
        first_name="Ana",
        sex=PatientSex.female,
        date_of_birth=date(1990, 5, 20),
    )
    snapshot = profile_to_snapshot(profile)
    assert snapshot["sex"] == "female"
    assert snapshot["date_of_birth"] == "1990-05-20"


def test_create_approve_and_reject_flow():
    db = SessionLocal()
    patient = User(
        email=f"change_patient_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="x",
        role=UserRole.patient,
    )
    doctor_user = User(
        email=f"change_doctor_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="x",
        role=UserRole.doctor,
    )
    db.add_all([patient, doctor_user])
    db.commit()
    db.refresh(patient)
    db.refresh(doctor_user)

    doctor_profile = DoctorProfile(
        user_id=doctor_user.id,
        display_name="Dr. Cambios",
        price_per_min_cents=100,
    )
    db.add(doctor_profile)
    db.commit()
    db.refresh(doctor_profile)

    try:
        # El médico propone nombre y alergias.
        request = create_change_request(
            db,
            patient=patient,
            doctor_profile=doctor_profile,
            payload=PatientProfileChangeRequestCreate(first_name="Ana", allergies="Penicilina"),
        )
        assert request.status == PatientProfileChangeStatus.pending
        assert set(json.loads(request.proposed_changes)) == {"first_name", "allergies"}

        # El paciente aprueba: se aplican los datos.
        resolve_change_request(db, request=request, action="approve", patient_note="Correcto")
        db.refresh(request)
        assert request.status == PatientProfileChangeStatus.approved
        assert request.resolved_at is not None

        profile = db.query(PatientProfile).filter(PatientProfile.user_id == patient.id).first()
        assert profile is not None
        assert profile.first_name == "Ana"
        assert profile.allergies == "Penicilina"

        # Una segunda propuesta rechazada no modifica el perfil.
        rejected = create_change_request(
            db,
            patient=patient,
            doctor_profile=doctor_profile,
            payload=PatientProfileChangeRequestCreate(first_name="Nombre erróneo"),
        )
        resolve_change_request(db, request=rejected, action="reject", patient_note=None)
        profile = db.query(PatientProfile).filter(PatientProfile.user_id == patient.id).first()
        assert profile.first_name == "Ana"

        # No se puede resolver dos veces.
        try:
            resolve_change_request(db, request=rejected, action="approve", patient_note=None)
            raise AssertionError("Debía fallar al resolver dos veces")
        except ValueError:
            pass
    finally:
        db.query(PatientProfileChangeRequest).filter(
            PatientProfileChangeRequest.patient_id == patient.id
        ).delete(synchronize_session=False)
        db.query(PatientProfile).filter(PatientProfile.user_id == patient.id).delete(
            synchronize_session=False
        )
        db.query(DoctorProfile).filter(DoctorProfile.id == doctor_profile.id).delete(
            synchronize_session=False
        )
        db.query(User).filter(User.id.in_([patient.id, doctor_user.id])).delete(
            synchronize_session=False
        )
        db.commit()
        db.close()
