"""Notificaciones en tiempo real: broker SSE y publicación tras commit."""

import asyncio
import uuid

from app.db.session import SessionLocal
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.services import notification_broker
from app.services.notification_service import notification_service


def test_publish_delivers_to_subscriber():
    async def scenario():
        queue = notification_broker.subscribe(101)
        notification_broker.publish(101, {"id": 1, "title": "Hola"})
        item = await asyncio.wait_for(queue.get(), timeout=1)
        notification_broker.unsubscribe(101, queue)
        return item

    assert asyncio.run(scenario()) == {"id": 1, "title": "Hola"}


def test_unsubscribe_stops_delivery():
    async def scenario():
        queue = notification_broker.subscribe(102)
        notification_broker.unsubscribe(102, queue)
        notification_broker.publish(102, {"id": 2})
        return queue.empty()

    assert asyncio.run(scenario()) is True


def test_notification_is_published_only_after_commit():
    async def scenario():
        db = SessionLocal()
        user = User(
            email=f"broker_{uuid.uuid4().hex[:8]}@example.com",
            password_hash="x",
            role=UserRole.patient,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        queue = notification_broker.subscribe(user.id)
        try:
            notification_service.create(
                db,
                user_id=user.id,
                notification_type="test",
                title="Nueva cita",
                body="Tienes una cita.",
            )
            # Todavía no se ha hecho commit: no debe haberse publicado.
            assert queue.empty()

            db.commit()
            payload = await asyncio.wait_for(queue.get(), timeout=1)
            assert payload["title"] == "Nueva cita"
            assert payload["status"] == "unread"
        finally:
            notification_broker.unsubscribe(user.id, queue)
            db.query(Notification).filter(Notification.user_id == user.id).delete(
                synchronize_session=False
            )
            db.query(User).filter(User.id == user.id).delete(synchronize_session=False)
            db.commit()
            db.close()

        return True

    assert asyncio.run(scenario()) is True
