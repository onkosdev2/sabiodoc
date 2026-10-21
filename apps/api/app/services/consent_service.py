"""Registro y revocación de consentimientos versionados."""

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.consent import Consent, ConsentType
from app.models.user import User


class ConsentService:
    def record(
        self,
        db: Session,
        *,
        user_id: int,
        consent_type: ConsentType,
        version: str,
        appointment_id: int | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        metadata: dict | None = None,
    ) -> Consent:
        """Registra una aceptación y revoca la anterior del mismo tipo/cita."""
        now = datetime.now(timezone.utc)
        query = db.query(Consent).filter(
            Consent.user_id == user_id,
            Consent.consent_type == consent_type,
            Consent.revoked_at.is_(None),
        )
        if appointment_id is None:
            query = query.filter(Consent.appointment_id.is_(None))
        else:
            query = query.filter(Consent.appointment_id == appointment_id)

        for previous in query.all():
            if previous.version == version:
                return previous
            previous.revoked_at = now

        consent = Consent(
            user_id=user_id,
            appointment_id=appointment_id,
            consent_type=consent_type,
            version=version,
            accepted_at=now,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata_json=json.dumps(metadata, ensure_ascii=False) if metadata else None,
        )
        db.add(consent)
        return consent

    def revoke(
        self,
        db: Session,
        *,
        user_id: int,
        consent_type: ConsentType,
        appointment_id: int | None = None,
    ) -> int:
        """Revoca los consentimientos activos del tipo indicado."""
        now = datetime.now(timezone.utc)
        query = db.query(Consent).filter(
            Consent.user_id == user_id,
            Consent.consent_type == consent_type,
            Consent.revoked_at.is_(None),
        )
        if appointment_id is not None:
            query = query.filter(Consent.appointment_id == appointment_id)
        rows = query.all()
        for consent in rows:
            consent.revoked_at = now
        return len(rows)

    def active_for_user(self, db: Session, user_id: int) -> list[Consent]:
        return (
            db.query(Consent)
            .filter(Consent.user_id == user_id, Consent.revoked_at.is_(None))
            .order_by(Consent.accepted_at.desc())
            .all()
        )

    def record_appointment_consents(
        self,
        db: Session,
        *,
        appointment,
        version: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        """Registra los consentimientos obligatorios de una cita."""
        for consent_type in (
            ConsentType.terms,
            ConsentType.privacy,
            ConsentType.telemedicine,
            ConsentType.clinical_data,
        ):
            self.record(
                db,
                user_id=appointment.patient_id,
                appointment_id=appointment.id,
                consent_type=consent_type,
                version=version,
                ip_address=ip_address,
                user_agent=user_agent,
                metadata={"doctor_id": appointment.doctor_id, "specialty_id": appointment.specialty_id},
            )


consent_service = ConsentService()
