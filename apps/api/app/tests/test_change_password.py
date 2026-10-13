"""Cambio de contraseña con confirmación por correo y revocación de sesiones."""

import hashlib
import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.main import app
from app.models.audit_log import AuditLog
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User, UserRole

client = TestClient(app)


def _make_user(password: str = "OldPass123!") -> User:
    db = SessionLocal()
    try:
        user = User(
            email=f"chpass_{uuid.uuid4().hex[:8]}@example.com",
            password_hash=get_password_hash(password),
        )
        user.set_roles({UserRole.patient})
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
        db.query(AuditLog).filter(AuditLog.actor_user_id == user_id).delete(
            synchronize_session=False
        )
        db.query(User).filter(User.id == user_id).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def _login(email: str, password: str) -> str:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_change_password_requiere_sesion():
    assert client.post(
        "/auth/change-password",
        json={"current_password": "OldPass123!", "new_password": "NewPass123!"},
    ).status_code in (401, 403)


def test_change_password_valida_actual_y_politica():
    user = _make_user()
    try:
        headers = {"Authorization": f"Bearer {_login(user.email, 'OldPass123!')}"}

        # Contraseña actual incorrecta.
        wrong = client.post(
            "/auth/change-password",
            json={"current_password": "Incorrecta123", "new_password": "NewPass123!"},
            headers=headers,
        )
        assert wrong.status_code == 400

        # Nueva igual a la actual.
        same = client.post(
            "/auth/change-password",
            json={"current_password": "OldPass123!", "new_password": "OldPass123!"},
            headers=headers,
        )
        assert same.status_code == 400

        # Nueva débil (sin número).
        weak = client.post(
            "/auth/change-password",
            json={"current_password": "OldPass123!", "new_password": "sololetras"},
            headers=headers,
        )
        assert weak.status_code == 422
    finally:
        _cleanup(user.id)


def test_change_password_flujo_completo(monkeypatch):
    user = _make_user()
    captured: dict[str, str] = {}

    def fake_send(to_email: str, changed_at: str, ip_address: str | None = None) -> bool:
        captured["to"] = to_email
        captured["changed_at"] = changed_at
        return True

    monkeypatch.setattr("app.routers.auth.send_password_changed_email", fake_send)

    try:
        old_token = _login(user.email, "OldPass123!")
        old_headers = {"Authorization": f"Bearer {old_token}"}
        assert client.get("/auth/me", headers=old_headers).status_code == 200

        response = client.post(
            "/auth/change-password",
            json={"current_password": "OldPass123!", "new_password": "NewPass123!"},
            headers=old_headers,
        )
        assert response.status_code == 200, response.text
        new_token = response.json()["access_token"]
        assert new_token != old_token

        # Se envió el correo de confirmación.
        assert captured["to"] == user.email

        # La sesión anterior queda revocada; la nueva sigue válida.
        assert client.get("/auth/me", headers=old_headers).status_code == 401
        new_headers = {"Authorization": f"Bearer {new_token}"}
        assert client.get("/auth/me", headers=new_headers).status_code == 200

        # Se puede iniciar sesión con la nueva contraseña.
        assert _login(user.email, "NewPass123!")

        # Queda registrado en auditoría.
        db = SessionLocal()
        try:
            entry = (
                db.query(AuditLog)
                .filter(
                    AuditLog.actor_user_id == user.id,
                    AuditLog.action == "user.password_changed",
                )
                .first()
            )
            assert entry is not None
        finally:
            db.close()
    finally:
        _cleanup(user.id)


def test_change_password_invalida_enlaces_de_reset(monkeypatch):
    user = _make_user()
    monkeypatch.setattr(
        "app.routers.auth.send_password_changed_email",
        lambda to_email, changed_at, ip_address=None: True,
    )
    db = SessionLocal()
    try:
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hashlib.sha256(b"pendiente").hexdigest(),
                expires_at=datetime.now(UTC) + timedelta(minutes=10),
            )
        )
        db.commit()
    finally:
        db.close()

    try:
        headers = {"Authorization": f"Bearer {_login(user.email, 'OldPass123!')}"}
        assert (
            client.post(
                "/auth/change-password",
                json={"current_password": "OldPass123!", "new_password": "NewPass123!"},
                headers=headers,
            ).status_code
            == 200
        )

        db = SessionLocal()
        try:
            pending = (
                db.query(PasswordResetToken)
                .filter(PasswordResetToken.user_id == user.id)
                .all()
            )
            assert pending and all(record.used_at is not None for record in pending)
        finally:
            db.close()
    finally:
        _cleanup(user.id)
