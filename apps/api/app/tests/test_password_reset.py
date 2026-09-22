"""Flujo de restablecimiento de contraseña."""

import hashlib
import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.main import app
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User, UserRole

client = TestClient(app)


def _make_user(password: str = "OldPass123!") -> User:
    db = SessionLocal()
    try:
        user = User(
            email=f"reset_{uuid.uuid4().hex[:8]}@example.com",
            password_hash=get_password_hash(password),
            role=UserRole.patient,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        db.expunge(user)
        return user
    finally:
        db.close()


def _cleanup(user_id: int) -> None:
    db = SessionLocal()
    try:
        db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user_id).delete(
            synchronize_session=False
        )
        db.query(User).filter(User.id == user_id).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def test_forgot_password_no_revela_si_el_correo_existe():
    response = client.post("/auth/forgot-password", json={"email": "noexiste_xyz@example.com"})

    assert response.status_code == 200
    assert "instrucciones" in response.json()["message"]


def test_flujo_completo_de_restablecimiento(monkeypatch):
    user = _make_user()
    captured: dict[str, str] = {}

    def fake_send(to_email: str, reset_url: str) -> bool:
        captured["to"] = to_email
        captured["url"] = reset_url
        return True

    monkeypatch.setattr("app.routers.auth.send_password_reset_email", fake_send)

    try:
        response = client.post("/auth/forgot-password", json={"email": user.email})
        assert response.status_code == 200
        assert captured["to"] == user.email
        token = captured["url"].split("token=")[1]

        # El token en claro no se guarda: solo su hash.
        db = SessionLocal()
        try:
            stored = db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).first()
            assert stored is not None
            assert stored.token_hash == _hash(token)
        finally:
            db.close()

        response = client.post(
            "/auth/reset-password", json={"token": token, "new_password": "NewPass123!"}
        )
        assert response.status_code == 200

        # La nueva contraseña funciona.
        login = client.post("/auth/login", json={"email": user.email, "password": "NewPass123!"})
        assert login.status_code == 200

        # El token es de un solo uso.
        reuse = client.post(
            "/auth/reset-password", json={"token": token, "new_password": "OtraPass123!"}
        )
        assert reuse.status_code == 400
    finally:
        _cleanup(user.id)


def test_reset_password_con_token_invalido():
    response = client.post(
        "/auth/reset-password",
        json={"token": "token-que-no-existe-123456", "new_password": "NewPass123!"},
    )
    assert response.status_code == 400


def test_reset_password_con_token_expirado():
    user = _make_user()
    raw_token = "token-expirado-1234567890"
    db = SessionLocal()
    try:
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=_hash(raw_token),
                expires_at=datetime.now(UTC) - timedelta(minutes=1),
            )
        )
        db.commit()
    finally:
        db.close()

    try:
        response = client.post(
            "/auth/reset-password",
            json={"token": raw_token, "new_password": "NewPass123!"},
        )
        assert response.status_code == 400
    finally:
        _cleanup(user.id)


def test_los_tokens_previos_dejan_de_valer_tras_el_reset(monkeypatch):
    """Cambiar la contraseña revoca las sesiones activas (session_version)."""
    user = _make_user()
    try:
        login = client.post("/auth/login", json={"email": user.email, "password": "OldPass123!"})
        old_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        assert client.get("/auth/me", headers=old_headers).status_code == 200

        captured: dict[str, str] = {}
        monkeypatch.setattr(
            "app.routers.auth.send_password_reset_email",
            lambda to_email, reset_url: captured.update(url=reset_url) or True,
        )
        client.post("/auth/forgot-password", json={"email": user.email})
        token = captured["url"].split("token=")[1]
        client.post("/auth/reset-password", json={"token": token, "new_password": "NewPass123!"})

        # El token emitido antes del cambio ya no vale.
        assert client.get("/auth/me", headers=old_headers).status_code == 401

        # Un login nuevo sí funciona.
        new_login = client.post(
            "/auth/login", json={"email": user.email, "password": "NewPass123!"}
        )
        assert new_login.status_code == 200
        new_headers = {"Authorization": f"Bearer {new_login.json()['access_token']}"}
        assert client.get("/auth/me", headers=new_headers).status_code == 200
    finally:
        _cleanup(user.id)
