"""Rate limiting en memoria (ventana deslizante).

Pensado para un despliegue de un solo proceso, igual que el broker de
notificaciones. Si algún día se escala a varios workers, habría que respaldarlo
con Redis. Se usa sobre todo para frenar fuerza bruta en autenticación.
"""

import threading
import time
from collections import deque
from typing import Callable

from fastapi import HTTPException, Request, status

from app.core.config import settings

# Umbral a partir del cual se purgan las claves caducadas para evitar crecer sin límite.
_CLEANUP_THRESHOLD = 1024


class SlidingWindowRateLimiter:
    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def check(
        self,
        key: str,
        *,
        max_requests: int,
        window_seconds: float,
    ) -> tuple[bool, float]:
        """Devuelve (permitido, segundos_para_reintentar)."""
        now = self._clock()
        cutoff = now - window_seconds

        with self._lock:
            self._purge_expired(cutoff)
            bucket = self._events.get(key)
            if bucket is None:
                bucket = deque()
                self._events[key] = bucket

            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= max_requests:
                retry_after = bucket[0] + window_seconds - now
                return False, max(retry_after, 0.0)

            bucket.append(now)
            return True, 0.0

    def reset(self) -> None:
        with self._lock:
            self._events.clear()

    def _purge_expired(self, cutoff: float) -> None:
        if len(self._events) < _CLEANUP_THRESHOLD:
            return
        stale = [key for key, bucket in self._events.items() if not bucket or bucket[-1] <= cutoff]
        for key in stale:
            self._events.pop(key, None)


rate_limiter = SlidingWindowRateLimiter()


def client_identifier(request: Request) -> str:
    """IP del cliente. Solo confía en X-Forwarded-For si hay un proxy delante."""
    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(key: str, *, max_requests: int, window_seconds: float) -> None:
    allowed, retry_after = rate_limiter.check(
        key, max_requests=max_requests, window_seconds=window_seconds
    )
    if allowed:
        return
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Demasiadas solicitudes. Intenta de nuevo más tarde.",
        headers={"Retry-After": str(int(retry_after) + 1)},
    )


def rate_limit_dependency(name: str, *, max_requests: int, window_seconds: float):
    """Dependencia de FastAPI que limita por IP."""

    def dependency(request: Request) -> None:
        enforce_rate_limit(
            f"{name}:{client_identifier(request)}",
            max_requests=max_requests,
            window_seconds=window_seconds,
        )

    return dependency
