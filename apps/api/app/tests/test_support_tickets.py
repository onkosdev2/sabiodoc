"""Tickets de soporte: creación por el usuario y bandeja de soporte."""

import uuid

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.notification import Notification
from app.models.support_ticket import SupportTicket
from app.models.user import User

client = TestClient(app)


def _register_patient() -> tuple[int, str, str]:
    email = f"ticket_{uuid.uuid4().hex[:8]}@example.com"
    password = "Ticket123!"
    response = client.post("/auth/register", json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    return response.json()["user"]["id"], email, password


def _login(email: str, password: str) -> dict:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _support_headers() -> dict:
    return _login("soporte.demo@sabiodoc.app", "SupportDemo123!")


def _cleanup_users(user_ids: list[int]) -> None:
    db = SessionLocal()
    try:
        db.query(Notification).filter(Notification.type.like("support_ticket%")).delete(
            synchronize_session=False
        )
        if user_ids:
            db.query(SupportTicket).filter(SupportTicket.user_id.in_(user_ids)).delete(
                synchronize_session=False
            )
            db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def test_flujo_completo_de_ticket():
    user_id, email, password = _register_patient()
    other_id, other_email, other_password = _register_patient()
    headers = _login(email, password)
    support = _support_headers()
    try:
        # El usuario crea el ticket.
        created = client.post(
            "/support/tickets",
            json={
                "subject": "No pude entrar a la videollamada",
                "category": "video",
                "message": "Al pulsar entrar me aparece un error y no carga la sala.",
                "context": {"url": "http://localhost:5173/video-room"},
            },
            headers=headers,
        )
        assert created.status_code == 201, created.text
        ticket = created.json()
        ticket_id = ticket["id"]
        assert ticket["reference"].startswith("TCK-")
        assert ticket["status"] == "open"
        assert ticket["priority"] == "high"  # categoría videollamada
        assert len(ticket["messages"]) == 1
        assert ticket["messages"][0]["author_role"] == "user"

        # El usuario ve su ticket.
        mine = client.get("/support/tickets", headers=headers)
        assert mine.status_code == 200
        assert any(item["id"] == ticket_id for item in mine.json()["tickets"])

        # Un usuario ajeno no puede verlo ni entrar a la bandeja.
        other = _login(other_email, other_password)
        assert client.get(f"/support/tickets/{ticket_id}", headers=other).status_code == 403
        assert client.get("/support/inbox", headers=other).status_code == 403

        # Soporte lo ve en la bandeja.
        inbox = client.get("/support/inbox?status_filter=open", headers=support)
        assert inbox.status_code == 200, inbox.text
        assert any(item["id"] == ticket_id for item in inbox.json()["tickets"])

        # Soporte responde -> waiting_user.
        reply = client.post(
            f"/support/tickets/{ticket_id}/messages",
            json={"message": "Estamos revisando tu caso."},
            headers=support,
        )
        assert reply.status_code == 201, reply.text
        assert reply.json()["author_role"] == "support"
        detail = client.get(f"/support/tickets/{ticket_id}", headers=headers).json()
        assert detail["status"] == "waiting_user"
        assert len(detail["messages"]) == 2

        # El usuario responde -> se reabre.
        user_reply = client.post(
            f"/support/tickets/{ticket_id}/messages",
            json={"message": "Sigue fallando, gracias."},
            headers=headers,
        )
        assert user_reply.status_code == 201
        assert client.get(f"/support/tickets/{ticket_id}", headers=headers).json()["status"] == "open"

        # Soporte cambia estado/prioridad a resuelto (aún reabrible, sin cierre).
        resolved = client.patch(
            f"/support/inbox/{ticket_id}",
            json={"status": "resolved", "priority": "urgent"},
            headers=support,
        )
        assert resolved.status_code == 200, resolved.text
        assert resolved.json()["status"] == "resolved"
        assert resolved.json()["priority"] == "urgent"
        assert resolved.json()["closed_at"] is None  # resuelto no cierra

        # El usuario responde a un resuelto -> se reabre.
        reopened = client.post(
            f"/support/tickets/{ticket_id}/messages",
            json={"message": "El problema sigue."},
            headers=headers,
        )
        assert reopened.status_code == 201, reopened.text
        assert client.get(f"/support/tickets/{ticket_id}", headers=headers).json()["status"] == "open"

        # Soporte lo cierra definitivamente -> fija closed_at.
        closed = client.patch(
            f"/support/inbox/{ticket_id}",
            json={"status": "closed"},
            headers=support,
        )
        assert closed.status_code == 200, closed.text
        assert closed.json()["status"] == "closed"
        assert closed.json()["closed_at"] is not None

        # Un ticket cerrado ya no admite respuestas (409).
        blocked = client.post(
            f"/support/tickets/{ticket_id}/messages",
            json={"message": "¿Alguien?"},
            headers=headers,
        )
        assert blocked.status_code == 409

        # El usuario recibió notificaciones in-app.
        db = SessionLocal()
        try:
            notifications = (
                db.query(Notification)
                .filter(
                    Notification.user_id == user_id,
                    Notification.type.like("support_ticket%"),
                )
                .count()
            )
            assert notifications >= 2
        finally:
            db.close()
    finally:
        _cleanup_users([user_id, other_id])


def test_ticket_requiere_sesion():
    assert client.get("/support/tickets").status_code in (401, 403)
    assert client.get("/support/inbox").status_code in (401, 403)
