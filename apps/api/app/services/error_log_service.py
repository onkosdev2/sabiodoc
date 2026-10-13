"""Registro centralizado de errores.

Captura errores del backend (excepciones no controladas, HTTP 5xx y fallos de
videoconsulta) y reportes del navegador, y los persiste en ``error_logs`` para
que el panel de administración los muestre.

Reglas de diseño:
- ``record`` nunca propaga excepciones: un fallo al registrar un error jamás
  debe tumbar la respuesta que ve el usuario.
- Usa su propia sesión de base de datos para que el registro sobreviva a un
  ``rollback`` de la transacción que originó el error.
- Sanitiza el contexto para no guardar contraseñas, tokens ni cabeceras de
  autorización.
"""

import hashlib
import json
import re
import threading
import time
import traceback
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import Request
from sqlalchemy import func

from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.error_log import ErrorLog
from app.models.user import User

logger = get_logger(__name__)

# Claves cuyo valor se oculta por completo antes de guardar el contexto.
_SENSITIVE_KEY_MARKERS = (
    "password",
    "passwd",
    "secret",
    "token",
    "authorization",
    "auth",
    "jwt",
    "api_key",
    "apikey",
    "cookie",
    "credit_card",
    "card_number",
    "cvv",
)
_REDACTED = "[REDACTED]"
_MAX_CONTEXT_DEPTH = 5


class ErrorLogService:
    def __init__(self) -> None:
        self._last_cleanup = 0.0
        self._cleanup_lock = threading.Lock()

    # ------------------------------------------------------------------
    # Registro
    # ------------------------------------------------------------------
    def record(
        self,
        *,
        message: str,
        level: str = "error",
        source: str = "backend",
        status_code: int | None = None,
        method: str | None = None,
        path: str | None = None,
        error_type: str | None = None,
        stack_trace: str | None = None,
        user_id: int | None = None,
        user_email: str | None = None,
        user_role: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
        video_session_id: int | None = None,
        appointment_id: int | None = None,
        consultation_id: int | None = None,
        context: dict[str, Any] | None = None,
    ) -> None:
        """Guarda una ocurrencia. No lanza nunca (solo loguea si falla)."""
        try:
            message = self._truncate(str(message or "Error sin mensaje"), 20000)
            entry = ErrorLog(
                level=self._normalize_level(level),
                source=self._normalize_source(source),
                status_code=status_code,
                method=(method or None),
                path=self._truncate(path, 500) if path else None,
                error_type=self._truncate(error_type, 200) if error_type else None,
                message=message,
                stack_trace=self._truncate(stack_trace, settings.ERROR_LOG_MAX_TEXT_CHARS)
                if stack_trace
                else None,
                user_id=user_id,
                user_email=self._truncate(user_email, 255) if user_email else None,
                user_role=self._truncate(user_role, 20) if user_role else None,
                ip_address=self._truncate(ip_address, 64) if ip_address else None,
                user_agent=self._truncate(user_agent, 500) if user_agent else None,
                request_id=self._truncate(request_id, 64) if request_id else None,
                video_session_id=video_session_id,
                appointment_id=appointment_id,
                consultation_id=consultation_id,
                context_json=self._dump_context(context),
                fingerprint=self.build_fingerprint(
                    source=source,
                    error_type=error_type,
                    method=method,
                    path=path,
                    message=message,
                ),
            )
            with SessionLocal() as db:
                db.add(entry)
                db.commit()
        except Exception as exc:  # pragma: no cover - defensivo
            logger.error(f"No se pudo guardar el error en la base de datos: {exc}", exc_info=True)

    def record_exception(self, exc: BaseException, **kwargs: Any) -> None:
        """Atajo que deriva mensaje, tipo y stack trace de una excepción."""
        stack = "".join(
            traceback.format_exception(type(exc), exc, exc.__traceback__)
        )
        self.record(
            message=kwargs.pop("message", None) or str(exc) or type(exc).__name__,
            error_type=type(exc).__name__,
            stack_trace=stack,
            **kwargs,
        )

    # ------------------------------------------------------------------
    # Contexto de la petición
    # ------------------------------------------------------------------
    @staticmethod
    def request_details(request: Request) -> dict[str, Any]:
        """Extrae los datos de la petición que interesan para depurar."""
        forwarded = request.headers.get("x-forwarded-for")
        if settings.TRUST_PROXY_HEADERS and forwarded:
            ip_address = forwarded.split(",")[0].strip()
        else:
            ip_address = request.client.host if request.client else None
        return {
            "method": request.method,
            "path": request.url.path,
            "ip_address": ip_address,
            "user_agent": request.headers.get("user-agent"),
            "request_id": getattr(request.state, "request_id", None),
        }

    @staticmethod
    def resolve_request_user(request: Request) -> tuple[int | None, str | None, str | None]:
        """Resuelve (user_id, email, rol) desde el token, sin lanzar errores."""
        header = request.headers.get("authorization") or ""
        if not header.lower().startswith("bearer "):
            return None, None, None
        token = header.split(" ", 1)[1].strip()
        payload = decode_access_token(token)
        if not payload:
            return None, None, None
        user_id = payload.get("sub")
        if user_id is None:
            return None, None, None
        try:
            with SessionLocal() as db:
                user = db.query(User).filter(User.id == int(user_id)).first()
                if not user:
                    return None, None, None
                return user.id, user.email, user.primary_role.value
        except Exception:
            return None, None, None

    # ------------------------------------------------------------------
    # Limpieza
    # ------------------------------------------------------------------
    def cleanup_old(self, *, days: int | None = None) -> int:
        retention_days = days or settings.ERROR_LOG_RETENTION_DAYS
        if retention_days <= 0:
            return 0
        cutoff = datetime.now(UTC) - timedelta(days=retention_days)
        try:
            with SessionLocal() as db:
                deleted = (
                    db.query(ErrorLog)
                    .filter(ErrorLog.created_at < cutoff)
                    .delete(synchronize_session=False)
                )
                db.commit()
                if deleted:
                    logger.info(f"Purge de error_logs: {deleted} registros con más de {retention_days} días")
                return int(deleted or 0)
        except Exception as exc:  # pragma: no cover - defensivo
            logger.error(f"No se pudo purgar error_logs: {exc}", exc_info=True)
            return 0

    def maybe_cleanup(self, *, interval_seconds: float = 3600.0) -> None:
        """Purga como máximo una vez por intervalo (se llama al listar)."""
        now = time.monotonic()
        with self._cleanup_lock:
            if now - self._last_cleanup < interval_seconds:
                return
            self._last_cleanup = now
        self.cleanup_old()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def build_fingerprint(
        *,
        source: str | None,
        error_type: str | None,
        method: str | None,
        path: str | None,
        message: str,
    ) -> str:
        # Normaliza números y UUIDs para agrupar errores equivalentes.
        normalized = re.sub(r"\b[0-9a-f]{8,}\b", "#", message.lower())
        normalized = re.sub(r"\d+", "#", normalized)
        normalized = re.sub(r"\s+", " ", normalized).strip()[:400]
        raw = "|".join(
            [
                (source or "").lower(),
                (error_type or "").lower(),
                (method or "").upper(),
                (path or "").lower(),
                normalized,
            ]
        )
        return hashlib.sha256(raw.encode("utf-8", "ignore")).hexdigest()[:40]

    @staticmethod
    def _normalize_level(level: str | None) -> str:
        value = (level or "error").lower()
        return value if value in {"error", "warning", "info"} else "error"

    @staticmethod
    def _normalize_source(source: str | None) -> str:
        value = (source or "backend").lower()
        return value if value in {"backend", "client"} else "backend"

    @staticmethod
    def _truncate(value: str | None, limit: int) -> str | None:
        if value is None:
            return None
        if len(value) <= limit:
            return value
        return value[: limit - 1] + "…"

    def _dump_context(self, context: dict[str, Any] | None) -> str | None:
        if not context:
            return None
        try:
            sanitized = self._sanitize(context, depth=0)
            return self._truncate(
                json.dumps(sanitized, ensure_ascii=False, default=str),
                settings.ERROR_LOG_MAX_TEXT_CHARS,
            )
        except Exception:
            return None

    def _sanitize(self, value: Any, *, depth: int) -> Any:
        if depth > _MAX_CONTEXT_DEPTH:
            return "[…]"
        if isinstance(value, dict):
            result: dict[str, Any] = {}
            for key, item in value.items():
                key_str = str(key)
                if any(marker in key_str.lower() for marker in _SENSITIVE_KEY_MARKERS):
                    result[key_str] = _REDACTED
                else:
                    result[key_str] = self._sanitize(item, depth=depth + 1)
            return result
        if isinstance(value, (list, tuple, set)):
            return [self._sanitize(item, depth=depth + 1) for item in list(value)[:50]]
        if isinstance(value, str):
            return self._truncate(value, 4000)
        if isinstance(value, (int, float, bool)) or value is None:
            return value
        return self._truncate(str(value), 4000)

    # ------------------------------------------------------------------
    # Consultas para el panel de admin
    # ------------------------------------------------------------------
    def fingerprint_counts(self, fingerprints: list[str]) -> dict[str, int]:
        clean = [fp for fp in fingerprints if fp]
        if not clean:
            return {}
        with SessionLocal() as db:
            rows = (
                db.query(ErrorLog.fingerprint, func.count(ErrorLog.id))
                .filter(ErrorLog.fingerprint.in_(clean))
                .group_by(ErrorLog.fingerprint)
                .all()
            )
        return {fingerprint: count for fingerprint, count in rows}


error_log_service = ErrorLogService()
