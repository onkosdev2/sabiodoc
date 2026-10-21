"""Consentimientos versionados."""

from types import SimpleNamespace

from app.db.session import SessionLocal
from app.models.consent import Consent, ConsentType
from app.models.user import User
from app.services.consent_service import consent_service


def _patient(db):
    return db.query(User).filter(User.email == "paciente.demo@sabiodoc.app").first()


def test_registra_revoca_y_versiona_consentimientos():
    db = SessionLocal()
    try:
        patient = _patient(db)
        assert patient is not None
        db.query(Consent).filter(Consent.user_id == patient.id).delete()
        db.commit()

        first = consent_service.record(
            db,
            user_id=patient.id,
            consent_type=ConsentType.terms,
            version="v1",
        )
        db.commit()

        same = consent_service.record(
            db,
            user_id=patient.id,
            consent_type=ConsentType.terms,
            version="v1",
        )
        assert same.id == first.id
        assert len(consent_service.active_for_user(db, patient.id)) == 1

        second = consent_service.record(
            db,
            user_id=patient.id,
            consent_type=ConsentType.terms,
            version="v2",
        )
        db.commit()

        active = consent_service.active_for_user(db, patient.id)
        assert len(active) == 1
        assert active[0].id == second.id
        assert active[0].version == "v2"

        revoked = consent_service.revoke(
            db,
            user_id=patient.id,
            consent_type=ConsentType.terms,
        )
        db.commit()
        assert revoked == 1
        assert consent_service.active_for_user(db, patient.id) == []
    finally:
        db.query(Consent).filter(Consent.user_id == _patient(db).id).delete()
        db.commit()
        db.close()


def test_registra_los_consentimientos_obligatorios_de_una_cita():
    db = SessionLocal()
    try:
        patient = _patient(db)
        db.query(Consent).filter(Consent.user_id == patient.id).delete()
        db.commit()

        appointment = SimpleNamespace(
            id=None,
            patient_id=patient.id,
            doctor_id=1,
            specialty_id=1,
        )
        consent_service.record_appointment_consents(
            db,
            appointment=appointment,
            version="v1",
        )
        db.commit()

        active = consent_service.active_for_user(db, patient.id)
        types = {consent.consent_type for consent in active}
        assert types == {
            ConsentType.terms,
            ConsentType.privacy,
            ConsentType.telemedicine,
            ConsentType.clinical_data,
        }
    finally:
        db.query(Consent).filter(Consent.user_id == _patient(db).id).delete()
        db.commit()
        db.close()
