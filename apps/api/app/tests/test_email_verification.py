"""Verificación de correo al registrarse."""

import hashlib
import uuid
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.main import app
from app.models.doctor_presence import DoctorPresence
from app.models.doctor_profile import DoctorProfile
from app.models.doctor_specialty import DoctorSpecialty
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User

client = TestClient(app)


def _doctor_payload(email: str, password: str = "Doctor123!") -> dict:
    return {
        "email": email,
        "password": password,
        "display_name": "Dr. Verificación",
        "professional_title": "Médico general",
        "bio_short": "Prueba de verificación",
        "price_per_min_cents": 500,
        "license_number": "CMP-12345",
        "license_country": "Perú",
        "country": "Perú",
        "city": "Lima",
        "address": "Av. Prueba 123",
        "timezone": "America/Lima",
        "government_id": "12345678",
        "years_experience": 5,
        "specialty_ids": [1],
        "accepted_terms": True,
        "consent_text_version": "v1",
    }


def _cleanup_users(emails: list[str]) -> None:
    db = SessionLocal()
    try:
        user_ids = [row[0] for row in db.query(User.id).filter(User.email.in_(emails)).all()]
        if user_ids:
            profile_ids = [
                row[0]
                for row in db.query(DoctorProfile.id)
                .filter(DoctorProfile.user_id.in_(user_ids))
                .all()
            ]
            if profile_ids:
                db.query(DoctorSpecialty).filter(
                    DoctorSpecialty.doctor_id.in_(profile_ids)
                ).delete(synchronize_session=False)
                db.query(DoctorPresence).filter(
                    DoctorPresence.doctor_id.in_(profile_ids)
                ).delete(synchronize_session=False)
                db.query(DoctorProfile).filter(
                    DoctorProfile.id.in_(profile_ids)
                ).delete(synchronize_session=False)
            db.query(EmailVerificationToken).filter(
                EmailVerificationToken.user_id.in_(user_ids)
            ).delete(synchronize_session=False)
            db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def test_flujo_de_verificacion_de_correo(monkeypatch):
    sent: dict[str, str] = {}

    def fake_send(to_email: str, verify_url: str) -> bool:
        sent["to"] = to_email
        sent["url"] = verify_url
        return True

    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", True)
    monkeypatch.setattr("app.routers.auth.send_email_verification_email", fake_send)

    email = f"verify_{uuid.uuid4().hex[:8]}@example.com"
    try:
        registered = client.post(
            "/auth/register", json={"email": email, "password": "Verify123!"}
        )
        assert registered.status_code == 201, registered.text
        body = registered.json()
        assert body["verification_required"] is True
        assert body["access_token"] is None
        assert sent["to"] == email

        # No puede iniciar sesión sin verificar el correo.
        blocked = client.post("/auth/login", json={"email": email, "password": "Verify123!"})
        assert blocked.status_code == 403, blocked.text

        # El token viaja en el enlace del correo.
        token = parse_qs(urlparse(sent["url"]).query)["token"][0]

        verified = client.post("/auth/verify-email", json={"token": token})
        assert verified.status_code == 200, verified.text

        # Ahora sí puede iniciar sesión.
        logged = client.post("/auth/login", json={"email": email, "password": "Verify123!"})
        assert logged.status_code == 200, logged.text
        assert logged.json()["user"]["is_email_verified"] is True

        # El token es de un solo uso.
        assert client.post("/auth/verify-email", json={"token": token}).status_code == 400
    finally:
        _cleanup_users([email])


def test_reenviar_verificacion(monkeypatch):
    sent: list[str] = []

    def fake_send(to_email: str, verify_url: str) -> bool:
        sent.append(to_email)
        return True

    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", True)
    monkeypatch.setattr("app.routers.auth.send_email_verification_email", fake_send)

    email = f"resend_{uuid.uuid4().hex[:8]}@example.com"
    try:
        client.post("/auth/register", json={"email": email, "password": "Resend123!"})
        sent.clear()

        response = client.post("/auth/resend-verification", json={"email": email})
        assert response.status_code == 200
        assert sent == [email]

        # Un correo inexistente no revela nada ni falla.
        assert (
            client.post(
                "/auth/resend-verification", json={"email": "nadie@example.com"}
            ).status_code
            == 200
        )
    finally:
        _cleanup_users([email])


def test_registro_sin_verificacion_devuelve_token(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", False)
    email = f"noverify_{uuid.uuid4().hex[:8]}@example.com"
    try:
        response = client.post("/auth/register", json={"email": email, "password": "NoVerify123!"})
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["verification_required"] is False
        assert body["access_token"]
        assert body["user"]["email"] == email
    finally:
        _cleanup_users([email])


def test_registro_medico_envia_correo_de_verificacion(monkeypatch):
    """El alta de un médico nuevo debe disparar el mismo correo que un paciente."""
    sent: list[tuple[str, str]] = []

    def fake_send(to_email: str, verify_url: str) -> bool:
        sent.append((to_email, verify_url))
        return True

    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", True)
    monkeypatch.setattr("app.routers.auth.send_email_verification_email", fake_send)

    email = f"doctor_verify_{uuid.uuid4().hex[:8]}@example.com"
    try:
        response = client.post("/auth/register/doctor", json=_doctor_payload(email))
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["verification_required"] is True
        assert body["email_sent"] is True
        assert body["access_token"] is None
        assert sent and sent[0][0] == email
    finally:
        _cleanup_users([email])


def test_registro_medico_reintenta_si_el_correo_sigue_sin_verificar(monkeypatch):
    """Repetir la postulación con la misma cuenta debe reenviar el enlace."""
    sent: list[str] = []

    def fake_send(to_email: str, verify_url: str) -> bool:
        sent.append(to_email)
        return True

    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", True)
    monkeypatch.setattr("app.routers.auth.send_email_verification_email", fake_send)

    email = f"doctor_retry_{uuid.uuid4().hex[:8]}@example.com"
    try:
        first = client.post("/auth/register/doctor", json=_doctor_payload(email))
        assert first.status_code == 201, first.text
        assert first.json()["verification_required"] is True
        assert sent == [email]

        # El usuario no recibió el correo y vuelve a enviar el formulario.
        retry = client.post("/auth/register/doctor", json=_doctor_payload(email))
        assert retry.status_code == 201, retry.text
        assert retry.json()["verification_required"] is True
        assert retry.json()["email_sent"] is True
        assert sent == [email, email]
    finally:
        _cleanup_users([email])


def test_registro_medico_con_correo_ya_verificado_no_reenvia(monkeypatch):
    """Si el correo ya estaba verificado (p. ej. era paciente), no se envía otro enlace."""
    sent: list[str] = []

    def fake_send(to_email: str, verify_url: str) -> bool:
        sent.append(to_email)
        return True

    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", True)
    monkeypatch.setattr("app.routers.auth.send_email_verification_email", fake_send)

    email = f"doctor_verified_{uuid.uuid4().hex[:8]}@example.com"
    try:
        patient = client.post(
            "/auth/register", json={"email": email, "password": "Doctor123!"}
        )
        assert patient.status_code == 201, patient.text
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == email).first()
            user.is_email_verified = True
            db.commit()
        finally:
            db.close()
        sent.clear()

        response = client.post("/auth/register/doctor", json=_doctor_payload(email))
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["verification_required"] is False
        assert body["email_sent"] is None
        assert sent == []
    finally:
        _cleanup_users([email])


def test_registro_avisa_si_el_correo_no_pudo_enviarse(monkeypatch):
    """La API no debe afirmar que el correo salió cuando el envío falló."""
    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", True)
    monkeypatch.setattr(
        "app.routers.auth.send_email_verification_email",
        lambda to_email, verify_url: False,
    )

    email = f"verify_fail_{uuid.uuid4().hex[:8]}@example.com"
    try:
        response = client.post("/auth/register", json={"email": email, "password": "Verify123!"})
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["verification_required"] is True
        assert body["email_sent"] is False
        assert "no pudimos enviar" in body["message"].lower()
    finally:
        _cleanup_users([email])


def test_admin_puede_eliminar_usuario_con_tokens_de_verificacion():
    """El borrado de cuentas no debe fallar por tokens de verificación pendientes."""
    from datetime import UTC, datetime, timedelta

    from app.models.email_verification_token import EmailVerificationToken
    from app.models.user import UserRole

    db = SessionLocal()
    try:
        user = User(
            email=f"deltok_{uuid.uuid4().hex[:8]}@example.com",
            password_hash=get_password_hash("AdminVerify123!"),
            is_email_verified=False,
        )
        user.set_roles({UserRole.patient})
        db.add(user)
        db.flush()
        db.add(
            EmailVerificationToken(
                user_id=user.id,
                token_hash=uuid.uuid4().hex + uuid.uuid4().hex,
                expires_at=datetime.now(UTC) + timedelta(hours=1),
            )
        )
        db.commit()
        user_id = user.id
    finally:
        db.close()

    login = client.post(
        "/auth/login", json={"email": "admin.demo@sabiodoc.app", "password": "AdminDemo123!"}
    )
    assert login.status_code == 200, login.text
    admin = {"Authorization": f"Bearer {login.json()['access_token']}"}

    response = client.delete(f"/admin/users/{user_id}", headers=admin)
    assert response.status_code == 204, response.text

    db = SessionLocal()
    try:
        assert db.query(User).filter(User.id == user_id).first() is None
    finally:
        db.close()


def test_admin_puede_confirmar_el_correo_manualmente(monkeypatch):
    """Soporte administrativo puede destrabar una cuenta sin el enlace del correo."""
    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", True)
    from datetime import UTC, datetime, timedelta

    from app.models.user import UserRole

    email = f"admin_verify_{uuid.uuid4().hex[:8]}@example.com"
    raw_token = uuid.uuid4().hex + uuid.uuid4().hex
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    db = SessionLocal()
    try:
        user = User(
            email=email,
            password_hash=get_password_hash("AdminVerify123!"),
            is_email_verified=False,
        )
        user.set_roles({UserRole.patient})
        db.add(user)
        db.flush()
        db.add(
            EmailVerificationToken(
                user_id=user.id,
                token_hash=token_hash,
                expires_at=datetime.now(UTC) + timedelta(hours=1),
            )
        )
        db.commit()
        user_id = user.id
    finally:
        db.close()

    try:
        # La cuenta no puede iniciar sesión mientras siga sin verificar.
        blocked = client.post("/auth/login", json={"email": email, "password": "AdminVerify123!"})
        assert blocked.status_code in (401, 403)

        # Login de un administrador demo.
        login = client.post(
            "/auth/login", json={"email": "admin.demo@sabiodoc.app", "password": "AdminDemo123!"}
        )
        assert login.status_code == 200, login.text
        admin = {"Authorization": f"Bearer {login.json()['access_token']}"}

        response = client.post(f"/admin/users/{user_id}/verify-email", headers=admin)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["email"] == email
        assert body["is_email_verified"] is True

        # La operación es idempotente.
        again = client.post(f"/admin/users/{user_id}/verify-email", headers=admin)
        assert again.status_code == 200, again.text
        assert again.json()["is_email_verified"] is True

        # El token pendiente queda invalidado.
        db = SessionLocal()
        try:
            token = db.query(EmailVerificationToken).filter(
                EmailVerificationToken.user_id == user_id
            ).first()
            assert token is not None
            assert token.used_at is not None
        finally:
            db.close()
    finally:
        _cleanup_users([email])
