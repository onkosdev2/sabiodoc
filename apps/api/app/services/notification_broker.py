"""Pub/sub en memoria para notificaciones en tiempo real (SSE).

Cada cliente conectado se suscribe con una `asyncio.Queue`. Cuando se crea una
notificación y la transacción hace commit, se publica el payload a las colas del
usuario correspondiente. Funciona en un solo proceso (uvicorn); si algún día se
escala a varios workers, habría que sustituirlo por Redis/Postgres NOTIFY.
"""

import asyncio
from collections import defaultdict

from sqlalchemy import event
from sqlalchemy.orm import Session

_subscribers: dict[int, set[asyncio.Queue]] = defaultdict(set)
_loop: asyncio.AbstractEventLoop | None = None


def subscribe(user_id: int) -> asyncio.Queue:
    """Crea una cola para el usuario y recuerda el event loop en uso."""
    global _loop
    _loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers[user_id].add(queue)
    return queue


def unsubscribe(user_id: int, queue: asyncio.Queue) -> None:
    subscribers = _subscribers.get(user_id)
    if not subscribers:
        return
    subscribers.discard(queue)
    if not subscribers:
        _subscribers.pop(user_id, None)


def _dispatch(user_id: int, payload: dict) -> None:
    for queue in list(_subscribers.get(user_id, ())):
        try:
            queue.put_nowait(payload)
        except asyncio.QueueFull:
            pass


def publish(user_id: int, payload: dict) -> None:
    """Publica desde cualquier hilo, saltando al event loop si es necesario."""
    loop = _loop
    if loop is None or loop.is_closed():
        return

    try:
        running = asyncio.get_running_loop()
    except RuntimeError:
        running = None

    if running is loop:
        _dispatch(user_id, payload)
        return

    try:
        loop.call_soon_threadsafe(_dispatch, user_id, payload)
    except RuntimeError:
        # El event loop ya no está disponible (p. ej. tras un reload).
        pass


@event.listens_for(Session, "after_commit")
def _publish_after_commit(session: Session) -> None:
    """Publica las notificaciones solo cuando la transacción ya se confirmó."""
    pending = session.info.pop("pending_notifications", None)
    if not pending:
        return
    for user_id, payload in pending:
        publish(user_id, payload)
