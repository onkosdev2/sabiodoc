"""Archivos compartidos en la videoconsulta (Cloudinary)."""

import uuid
from datetime import UTC, datetime, timedelta
from io import BytesIO

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.doctor_profile import DoctorProfile
from app.models.user import User, UserRole
from app.models.video_session import PaymentStatus, VideoProvider, VideoSession, VideoSessionStatus
from app.models.video_session_event import VideoSessionEvent
from app.models.video_session_file import VideoSessionFile
from app.services import session_file_service


def _make_user(db, role: UserRole = UserRole.patient) -> User:
    user = User(email=f"file_{uuid.uuid4().hex[:8]}@example.com", password_hash="x", role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_session(db, patient: User, doctor: User) -> VideoSession:
    profile = DoctorProfile(user_id=doctor.id, display_name="Dr. Files", price_per_min_cents=100)
    db.add(profile)
    db.commit()
    db.refresh(profile)

    now = datetime.now(UTC)
    session = VideoSession(
        patient_id=patient.id,
        doctor_id=profile.id,
        provider=VideoProvider.jitsi,
        status=VideoSessionStatus.active,
        payment_status=PaymentStatus.pending,
        provider_room_name=f"sabiodoc-files-{uuid.uuid4().hex[:10]}",
        doctor_price_per_min_cents=100,
        estimated_minutes=30,
        prepaid_amount_cents=0,
        expires_at=now + timedelta(hours=1),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _upload(name: str = "receta.pdf") -> UploadFile:
    return UploadFile(
        filename=name,
        file=BytesIO(b"%PDF-1.4 contenido"),
        headers=Headers({"content-type": "application/pdf"}),
    )


def _fake_cloudinary_result():
    return {
        "resource_type": "raw",
        "format": "pdf",
        "bytes": 18,
        "url": "http://res.cloudinary.com/demo/raw/upload/v1/receta.pdf",
        "secure_url": "https://res.cloudinary.com/demo/raw/upload/v1/receta.pdf",
        "public_id": "sabiodoc/session-files/receta",
    }


def test_upload_guarda_metadatos_y_habilita_cloudinary(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "demo")
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", "key")
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", "secret")
    monkeypatch.setattr(session_file_service.cloudinary.uploader, "upload", lambda *a, **k: _fake_cloudinary_result())

    db = SessionLocal()
    patient = _make_user(db)
    doctor = _make_user(db, UserRole.doctor)
    session = _make_session(db, patient, doctor)
    try:
        record = session_file_service.upload_session_file(db, session, patient, "patient", _upload())

        assert record.original_name == "receta.pdf"
        assert record.uploader_role == "patient"
        assert record.secure_url.endswith("receta.pdf")
        assert session_file_service.count_files_for_uploader(db, session.id, patient.id) == 1
        assert len(session_file_service.list_session_files(db, session.id)) == 1
    finally:
        _cleanup(db, session.id, [patient.id, doctor.id])


def test_upload_falla_si_cloudinary_no_esta_configurado(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", None)
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", None)
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", None)

    db = SessionLocal()
    patient = _make_user(db)
    doctor = _make_user(db, UserRole.doctor)
    session = _make_session(db, patient, doctor)
    try:
        with pytest.raises(HTTPException) as exc:
            session_file_service.upload_session_file(db, session, patient, "patient", _upload())
        assert exc.value.status_code == 503
    finally:
        _cleanup(db, session.id, [patient.id, doctor.id])


def test_limite_de_10_archivos_por_participante(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "demo")
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", "key")
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", "secret")
    monkeypatch.setattr(session_file_service.cloudinary.uploader, "upload", lambda *a, **k: _fake_cloudinary_result())

    db = SessionLocal()
    patient = _make_user(db)
    doctor = _make_user(db, UserRole.doctor)
    session = _make_session(db, patient, doctor)
    try:
        for index in range(settings.SESSION_FILES_MAX):
            session_file_service.upload_session_file(db, session, patient, "patient", _upload(f"f{index}.pdf"))

        with pytest.raises(HTTPException) as exc:
            session_file_service.upload_session_file(db, session, patient, "patient", _upload("extra.pdf"))
        assert exc.value.status_code == 400

        # El doctor tiene su propio cupo.
        doctor_record = session_file_service.upload_session_file(db, session, doctor, "doctor", _upload("doc.pdf"))
        assert doctor_record.uploader_role == "doctor"
    finally:
        _cleanup(db, session.id, [patient.id, doctor.id])


def _cleanup(db, session_id: int, user_ids: list[int]) -> None:
    db.query(VideoSessionFile).filter(VideoSessionFile.video_session_id == session_id).delete(
        synchronize_session=False
    )
    db.query(VideoSessionEvent).filter(VideoSessionEvent.video_session_id == session_id).delete(
        synchronize_session=False
    )
    db.query(VideoSession).filter(VideoSession.id == session_id).delete(synchronize_session=False)
    db.query(DoctorProfile).filter(DoctorProfile.user_id.in_(user_ids)).delete(synchronize_session=False)
    db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
    db.commit()


def test_endpoint_acepta_multipart(monkeypatch):
    """Regresión: el POST debe parsear el FormData (antes daba 422 'Field required')."""
    from fastapi.testclient import TestClient

    from app.core.security import create_access_token
    from app.main import app

    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", None)
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", None)
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", None)

    client = TestClient(app)
    db = SessionLocal()
    patient = _make_user(db)
    doctor = _make_user(db, UserRole.doctor)
    session = _make_session(db, patient, doctor)
    try:
        token = create_access_token(
            data={"sub": str(patient.id), "ver": patient.session_version or 1}
        )
        response = client.post(
            f"/video-sessions/{session.id}/files",
            files={"file": ("TEST.txt", b"test", "text/plain")},
            headers={"Authorization": f"Bearer {token}"},
        )
        # Si el multipart se parsea, el endpoint llega al servicio: sin Cloudinary
        # responde 503 (no 422 por campo faltante).
        assert response.status_code == 503, response.text
    finally:
        _cleanup(db, session.id, [patient.id, doctor.id])
        db.close()


def test_error_de_configuracion_de_cloudinary(monkeypatch):
    from cloudinary.exceptions import AuthorizationRequired

    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "demo")
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", "key")
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", "secret")

    def _boom(*args, **kwargs):
        raise AuthorizationRequired("Invalid cloud_name demo")

    monkeypatch.setattr(session_file_service.cloudinary.uploader, "upload", _boom)

    db = SessionLocal()
    patient = _make_user(db)
    doctor = _make_user(db, UserRole.doctor)
    session = _make_session(db, patient, doctor)
    try:
        with pytest.raises(HTTPException) as exc:
            session_file_service.upload_session_file(db, session, patient, "patient", _upload())
        assert exc.value.status_code == 502
        assert "Cloudinary" in exc.value.detail
    finally:
        _cleanup(db, session.id, [patient.id, doctor.id])
        db.close()


def test_borrar_archivo_propio_y_ajeno(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "demo")
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", "key")
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", "secret")
    monkeypatch.setattr(session_file_service.cloudinary.uploader, "upload", lambda *a, **k: _fake_cloudinary_result())
    destroyed: list[str] = []
    monkeypatch.setattr(
        session_file_service.cloudinary.uploader,
        "destroy",
        lambda public_id, **k: destroyed.append(public_id) or {"result": "ok"},
    )

    db = SessionLocal()
    patient = _make_user(db)
    doctor = _make_user(db, UserRole.doctor)
    session = _make_session(db, patient, doctor)
    try:
        record = session_file_service.upload_session_file(db, session, patient, "patient", _upload())

        # Otro participante no puede borrar el archivo ajeno.
        with pytest.raises(HTTPException) as exc:
            session_file_service.delete_session_file(db, session, doctor, record.id)
        assert exc.value.status_code == 403

        # El autor sí puede; se borra en Cloudinary y en la BD.
        session_file_service.delete_session_file(db, session, patient, record.id)
        assert session_file_service.list_session_files(db, session.id) == []
        assert destroyed == [record.public_id]
    finally:
        _cleanup(db, session.id, [patient.id, doctor.id])
        db.close()


def test_upload_conserva_el_nombre_original(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "demo")
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", "key")
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", "secret")

    captured: dict = {}

    def _fake_upload(file, **kwargs):
        captured["kwargs"] = kwargs
        captured["name"] = getattr(file, "name", None)
        return _fake_cloudinary_result()

    monkeypatch.setattr(session_file_service.cloudinary.uploader, "upload", _fake_upload)

    db = SessionLocal()
    patient = _make_user(db)
    doctor = _make_user(db, UserRole.doctor)
    session = _make_session(db, patient, doctor)
    try:
        session_file_service.upload_session_file(db, session, patient, "patient", _upload("receta.pdf"))

        kwargs = captured["kwargs"]
        assert kwargs["use_filename"] is True
        assert kwargs["unique_filename"] is False
        assert kwargs["filename"] == "receta.pdf"
        assert kwargs["folder"].startswith(settings.CLOUDINARY_FOLDER + "/")
        assert captured["name"] == "receta.pdf"
    finally:
        _cleanup(db, session.id, [patient.id, doctor.id])
        db.close()
