"""Archivos adjuntos de una cita (incluye después de la videoconsulta)."""

import uuid
from datetime import UTC, datetime
from io import BytesIO

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.main import app
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor_profile import DoctorProfile
from app.models.notification import Notification
from app.models.specialty import Specialty
from app.models.user import User, UserRole
from app.models.video_session_file import VideoSessionFile
from app.services import session_file_service

client = TestClient(app)


def _make_user(db, role: UserRole) -> User:
    user = User(email=f"apptfile_{uuid.uuid4().hex[:8]}@example.com", password_hash="x", role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _token(user: User) -> dict:
    token = create_access_token(data={"sub": str(user.id), "ver": user.session_version or 1})
    return {"Authorization": f"Bearer {token}"}


def _fake_cloudinary_result():
    return {
        "resource_type": "raw",
        "format": "pdf",
        "bytes": 5,
        "url": "http://res.cloudinary.com/demo/raw/upload/v1/receta",
        "secure_url": "https://res.cloudinary.com/demo/raw/upload/v1/receta.pdf",
        "public_id": "sabiodoc/session-files/receta",
    }


def test_archivos_de_cita_tras_la_consulta(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "demo")
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", "key")
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", "secret")
    monkeypatch.setattr(
        session_file_service.cloudinary.uploader,
        "upload",
        lambda *a, **k: _fake_cloudinary_result(),
    )

    db = SessionLocal()
    patient = _make_user(db, UserRole.patient)
    doctor_user = _make_user(db, UserRole.doctor)
    other_patient = _make_user(db, UserRole.patient)

    profile = DoctorProfile(user_id=doctor_user.id, display_name="Dr. Recetas", price_per_min_cents=100)
    db.add(profile)
    db.commit()
    db.refresh(profile)

    specialty = db.query(Specialty).first()
    assert specialty is not None
    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=profile.id,
        specialty_id=specialty.id,
        scheduled_at=datetime.now(UTC),
        duration_minutes=30,
        status=AppointmentStatus.completed,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    file_id = None
    try:
        # El médico envía una receta ya terminada la consulta.
        response = client.post(
            f"/appointments/{appointment.id}/files",
            files={"file": ("receta.pdf", BytesIO(b"receta"), "application/pdf")},
            headers=_token(doctor_user),
        )
        assert response.status_code == 201, response.text
        payload = response.json()
        file_id = payload["id"]
        assert payload["uploader_role"] == "doctor"

        # El paciente la ve en el detalle de la cita.
        detail = client.get(
            f"/appointments/{appointment.id}", headers=_token(patient)
        )
        assert detail.status_code == 200
        assert len(detail.json()["files"]) == 1
        assert detail.json()["files"][0]["original_name"] == "receta.pdf"

        # Se notificó al paciente porque el archivo se envió fuera de la sesión.
        notification = (
            db.query(Notification)
            .filter(
                Notification.user_id == patient.id,
                Notification.type == "appointment_file_received",
            )
            .first()
        )
        assert notification is not None

        # Un tercero no puede subir ni ver.
        assert (
            client.post(
                f"/appointments/{appointment.id}/files",
                files={"file": ("x.txt", BytesIO(b"x"), "text/plain")},
                headers=_token(other_patient),
            ).status_code
            == 403
        )

        # Solo el autor borra (endpoint genérico, sirve desde el historial).
        assert (
            client.delete(f"/files/{file_id}", headers=_token(patient)).status_code == 403
        )
        assert (
            client.delete(f"/files/{file_id}", headers=_token(doctor_user)).status_code == 204
        )
    finally:
        db.query(VideoSessionFile).filter(
            VideoSessionFile.appointment_id == appointment.id
        ).delete(synchronize_session=False)
        db.query(Notification).filter(
            Notification.user_id.in_([patient.id, doctor_user.id, other_patient.id])
        ).delete(synchronize_session=False)
        db.query(Appointment).filter(Appointment.id == appointment.id).delete(
            synchronize_session=False
        )
        db.query(DoctorProfile).filter(DoctorProfile.id == profile.id).delete(
            synchronize_session=False
        )
        db.query(User).filter(User.id.in_([patient.id, doctor_user.id, other_patient.id])).delete(
            synchronize_session=False
        )
        db.commit()
        db.close()
