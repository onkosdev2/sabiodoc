"""Verificación de correo al registrarse."""

import uuid
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.session import SessionLocal
from app.main import app
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User

client = TestClient(app)


def _cleanup_users(emails: list[str]) -> None:
    db = SessionLocal()
    try:
        user_ids = [row[0] for row in db.query(User.id).filter(User.email.in_(emails)).all()]
        if user_ids:
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
