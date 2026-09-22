"""Envío de correos transaccionales (SMTP opcional).

Si no hay SMTP configurado:
- en desarrollo se registra el enlace en los logs para poder probar el flujo;
- en producción se avisa sin exponer el token.

Sustituir por un proveedor (SES, SendGrid, Resend…) es cuestión de cambiar
`send_password_reset_email`.
"""

import smtplib
from email.message import EmailMessage

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _build_password_reset_message(to_email: str, reset_url: str) -> EmailMessage:
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM or settings.SMTP_USER or "no-reply@sabiodoc.app"
    message["To"] = to_email
    message["Subject"] = "Restablece tu contraseña de SabioDoc"
    message.set_content(
        "Recibimos una solicitud para restablecer tu contraseña.\n\n"
        f"Abre este enlace para crear una nueva (caduca en {settings.PASSWORD_RESET_TOKEN_MINUTES} minutos):\n"
        f"{reset_url}\n\n"
        "Si no solicitaste este cambio, puedes ignorar este mensaje."
    )
    return message


def send_password_reset_email(to_email: str, reset_url: str) -> bool:
    if not settings.SMTP_HOST:
        if settings.is_production:
            logger.warning(
                "SMTP no configurado: no se pudo enviar el correo de restablecimiento a %s", to_email
            )
        else:
            logger.info("Enlace de restablecimiento para %s: %s", to_email, reset_url)
        return False

    message = _build_password_reset_message(to_email, reset_url)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
        server.send_message(message)
    return True
