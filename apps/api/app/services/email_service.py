"""Envío de correos transaccionales (SMTP).

Se usa únicamente para tres flujos:
- verificación de correo al registrarse (paciente y médico),
- restablecimiento de contraseña,
- aviso de cambio de contraseña (correo de confirmación de seguridad).

Todos comparten el mismo transporte SMTP (``_send``) y remitente (``_from_header``).

Si no hay SMTP configurado:
- en desarrollo se registra el enlace en los logs para poder probar el flujo;
- en producción se avisa sin exponer el token.
"""

import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _from_header() -> str:
    address = settings.SMTP_FROM or settings.SMTP_USER or "no-reply@sabiodoc.app"
    if "<" in address:
        return address
    return formataddr(("SabioDoc", address))


def _send(message: EmailMessage, *, to_email: str, kind: str, link: str | None = None) -> bool:
    if not settings.SMTP_HOST:
        if settings.is_production:
            logger.warning("SMTP no configurado: no se pudo enviar %s a %s", kind, to_email)
        elif link:
            logger.info("[%s] Enlace para %s: %s", kind, to_email, link)
        else:
            logger.info("[%s] Correo para %s (sin enlace)", kind, to_email)
        return False

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
            server.send_message(message)
        logger.info("Correo '%s' enviado a %s", kind, to_email)
        return True
    except Exception:
        logger.exception("No se pudo enviar el correo '%s' a %s", kind, to_email)
        return False


def _build_password_reset_message(to_email: str, reset_url: str) -> EmailMessage:
    message = EmailMessage()
    message["From"] = _from_header()
    message["To"] = to_email
    message["Subject"] = "Restablece tu contraseña de SabioDoc"
    message.set_content(
        "Recibimos una solicitud para restablecer tu contraseña.\n\n"
        f"Abre este enlace para crear una nueva (caduca en {settings.PASSWORD_RESET_TOKEN_MINUTES} minutos):\n"
        f"{reset_url}\n\n"
        "Si no solicitaste este cambio, puedes ignorar este mensaje."
    )
    return message


def _build_email_verification_message(to_email: str, verify_url: str) -> EmailMessage:
    message = EmailMessage()
    message["From"] = _from_header()
    message["To"] = to_email
    message["Subject"] = "Verifica tu correo para activar tu cuenta de SabioDoc"
    message.set_content(
        "¡Bienvenido a SabioDoc!\n\n"
        "Para activar tu cuenta, confirma tu correo electrónico abriendo este enlace:\n"
        f"{verify_url}\n\n"
        "El enlace caduca en "
        f"{settings.EMAIL_VERIFICATION_TOKEN_MINUTES // 60} horas. "
        "Si no creaste esta cuenta, puedes ignorar este mensaje."
    )
    return message


def send_password_reset_email(to_email: str, reset_url: str) -> bool:
    message = _build_password_reset_message(to_email, reset_url)
    return _send(message, to_email=to_email, link=reset_url, kind="password_reset")


def _build_password_changed_message(
    to_email: str, changed_at: str, ip_address: str | None = None
) -> EmailMessage:
    message = EmailMessage()
    message["From"] = _from_header()
    message["To"] = to_email
    message["Subject"] = "Tu contraseña de SabioDoc cambió"
    lines = [
        "Tu contraseña de SabioDoc se cambió correctamente.",
        "",
        f"Fecha: {changed_at}",
    ]
    if ip_address:
        lines.append(f"IP aproximada: {ip_address}")
    lines.extend(
        [
            "",
            "Si no fuiste tú, restablece tu contraseña de inmediato en:",
            f"{settings.primary_frontend_origin}/forgot-password",
            "",
            "Por seguridad, cerramos las demás sesiones activas de tu cuenta.",
        ]
    )
    message.set_content("\n".join(lines))
    return message


def send_password_changed_email(
    to_email: str, changed_at: str, ip_address: str | None = None
) -> bool:
    message = _build_password_changed_message(to_email, changed_at, ip_address)
    return _send(message, to_email=to_email, kind="password_changed")


def send_email_verification_email(to_email: str, verify_url: str) -> bool:
    message = _build_email_verification_message(to_email, verify_url)
    return _send(message, to_email=to_email, link=verify_url, kind="email_verification")
