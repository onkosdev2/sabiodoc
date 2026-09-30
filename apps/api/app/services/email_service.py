"""Envío de correos transaccionales (SMTP).

Se usa únicamente para dos flujos:
- verificación de correo al registrarse (paciente y médico),
- restablecimiento de contraseña.

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


def _send(message: EmailMessage, *, to_email: str, link: str, kind: str) -> bool:
    if not settings.SMTP_HOST:
        if settings.is_production:
            logger.warning("SMTP no configurado: no se pudo enviar %s a %s", kind, to_email)
        else:
            logger.info("[%s] Enlace para %s: %s", kind, to_email, link)
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


def send_email_verification_email(to_email: str, verify_url: str) -> bool:
    message = _build_email_verification_message(to_email, verify_url)
    return _send(message, to_email=to_email, link=verify_url, kind="email_verification")
