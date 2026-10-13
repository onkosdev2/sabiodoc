"""Sistema de tickets de soporte.

Un paciente o médico crea un ticket (con contexto de lo que le ocurre); el
equipo de soporte lo ve en su bandeja, responde y cambia el estado. Se avisa
por notificaciones in-app.
"""

import io
import json
import uuid
from datetime import UTC, datetime

import cloudinary
import cloudinary.uploader
from cloudinary.exceptions import AuthorizationRequired, NotAllowed
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.logging import get_logger
from app.models.error_log import ErrorLog
from app.models.support_ticket import (
    SupportTicket,
    SupportTicketAttachment,
    SupportTicketAuthorRole,
    SupportTicketCategory,
    SupportTicketMessage,
    SupportTicketPriority,
    SupportTicketStatus,
)
from app.models.user import User, UserRole, UserRoleAssignment, sorted_roles
from app.services.notification_service import notification_service
from app.services.patient_profile_service import get_patient_display_name

logger = get_logger(__name__)

# Prioridad sugerida según la categoría (soporte puede ajustarla).
_CATEGORY_PRIORITY = {
    SupportTicketCategory.app_error: SupportTicketPriority.high,
    SupportTicketCategory.video: SupportTicketPriority.high,
    SupportTicketCategory.payments: SupportTicketPriority.normal,
    SupportTicketCategory.account: SupportTicketPriority.normal,
    SupportTicketCategory.other: SupportTicketPriority.normal,
}

_ACTIVE_STATUSES = (
    SupportTicketStatus.open,
    SupportTicketStatus.in_progress,
    SupportTicketStatus.waiting_user,
)


def _display_name(user: User | None) -> str | None:
    if user is None:
        return None
    profile = getattr(user, "doctor_profile", None)
    if profile and profile.display_name:
        return profile.display_name
    return get_patient_display_name(user)


def _resource_type(content_type: str | None) -> str:
    if content_type:
        if content_type.startswith("image/"):
            return "image"
        if content_type.startswith("video/") or content_type.startswith("audio/"):
            return "video"
    return "raw"


class SupportTicketService:
    # ------------------------------------------------------------------
    # Adjuntos
    # ------------------------------------------------------------------
    def upload_attachment(
        self, db: Session, *, uploader: User, upload: UploadFile
    ) -> SupportTicketAttachment:
        if not settings.cloudinary_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="La carga de adjuntos no está configurada (Cloudinary).",
            )
        data = upload.file.read()
        max_bytes = settings.SESSION_FILE_MAX_MB * 1024 * 1024
        if len(data) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo está vacío.")
        if len(data) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El archivo supera el límite de {settings.SESSION_FILE_MAX_MB} MB.",
            )

        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        original_name = upload.filename or "adjunto"
        resource_type = _resource_type(upload.content_type)
        buffer = io.BytesIO(data)
        buffer.name = original_name
        try:
            result = cloudinary.uploader.upload(
                buffer,
                folder=f"{settings.CLOUDINARY_FOLDER}/support/{uuid.uuid4().hex}",
                resource_type=resource_type,
                filename=original_name,
                use_filename=True,
                unique_filename=False,
                use_filename_as_display_name=True,
                overwrite=False,
            )
        except (AuthorizationRequired, NotAllowed) as exc:
            logger.error(f"Cloudinary auth/config error (support): {exc}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="La configuración de Cloudinary no es válida.",
            ) from exc
        except Exception as exc:  # pragma: no cover - depende del proveedor
            logger.error(f"Cloudinary upload failed (support): {exc}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No se pudo subir el adjunto. Intenta de nuevo.",
            ) from exc

        record = SupportTicketAttachment(
            uploader_id=uploader.id,
            original_name=original_name,
            content_type=upload.content_type,
            resource_type=result.get("resource_type", resource_type),
            file_format=result.get("format"),
            bytes=result.get("bytes", len(data)),
            url=result.get("url", ""),
            secure_url=result.get("secure_url", ""),
            public_id=result.get("public_id", ""),
        )
        db.add(record)
        db.flush()
        return record

    def _attach(
        self,
        db: Session,
        *,
        uploader: User,
        attachment_ids: list[int],
        ticket_id: int,
        message_id: int,
    ) -> None:
        if not attachment_ids:
            return
        unique_ids = list(dict.fromkeys(attachment_ids))
        if len(unique_ids) > settings.SUPPORT_TICKET_MAX_ATTACHMENTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Máximo {settings.SUPPORT_TICKET_MAX_ATTACHMENTS} adjuntos por mensaje.",
            )
        rows = (
            db.query(SupportTicketAttachment)
            .filter(
                SupportTicketAttachment.id.in_(unique_ids),
                SupportTicketAttachment.uploader_id == uploader.id,
            )
            .all()
        )
        if len(rows) != len(unique_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Algún adjunto no existe o no te pertenece.",
            )
        for row in rows:
            if row.ticket_id is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Algún adjunto ya fue usado en otro ticket.",
                )
            row.ticket_id = ticket_id
            row.message_id = message_id
        db.flush()

    # ------------------------------------------------------------------
    # Tickets
    # ------------------------------------------------------------------
    def create_ticket(self, db: Session, *, user: User, subject, category, message, attachment_ids, context) -> SupportTicket:
        ticket_context = self._build_context(db, user=user, context=context)
        ticket = SupportTicket(
            user_id=user.id,
            subject=subject.strip(),
            category=category,
            status=SupportTicketStatus.open,
            priority=_CATEGORY_PRIORITY.get(category, SupportTicketPriority.normal),
            context_json=json.dumps(ticket_context, ensure_ascii=False),
            related_appointment_id=ticket_context.get("appointment_id"),
            related_video_session_id=ticket_context.get("video_session_id"),
            last_error_id=ticket_context.get("last_error_id"),
        )
        db.add(ticket)
        db.flush()
        ticket.reference = f"TCK-{ticket.id:05d}"

        first_message = SupportTicketMessage(
            ticket_id=ticket.id,
            author_user_id=user.id,
            author_role=SupportTicketAuthorRole.user,
            body=message.strip(),
        )
        db.add(first_message)
        db.flush()
        self._attach(
            db,
            uploader=user,
            attachment_ids=attachment_ids,
            ticket_id=ticket.id,
            message_id=first_message.id,
        )
        self._notify_support(db, ticket)
        db.commit()
        db.refresh(ticket)
        return ticket

    def add_message(
        self, db: Session, *, ticket: SupportTicket, author: User, body: str, attachment_ids: list[int]
    ) -> SupportTicketMessage:
        if ticket.status == SupportTicketStatus.closed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "El ticket está cerrado y no admite respuestas. "
                    "Reábrelo cambiando su estado o crea uno nuevo."
                ),
            )
        is_agent = author.is_admin or author.is_support
        author_role = SupportTicketAuthorRole.support if is_agent else SupportTicketAuthorRole.user

        message = SupportTicketMessage(
            ticket_id=ticket.id,
            author_user_id=author.id,
            author_role=author_role,
            body=body.strip(),
        )
        db.add(message)
        db.flush()
        self._attach(
            db,
            uploader=author,
            attachment_ids=attachment_ids,
            ticket_id=ticket.id,
            message_id=message.id,
        )

        if author_role == SupportTicketAuthorRole.support:
            ticket.status = SupportTicketStatus.waiting_user
            self._notify_owner(
                db,
                ticket,
                notification_type="support_ticket_reply",
                title=f"Respuesta a tu ticket {ticket.reference}",
                body=body.strip()[:180],
                action_label="Ver ticket",
            )
        else:
            if ticket.status in (
                SupportTicketStatus.resolved,
                SupportTicketStatus.waiting_user,
            ):
                ticket.status = SupportTicketStatus.open
            self._notify_support(db, ticket, reply=True)

        ticket.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(message)
        return message

    def update_ticket(
        self,
        db: Session,
        *,
        ticket: SupportTicket,
        status_value: SupportTicketStatus | None,
        priority_value: SupportTicketPriority | None,
        assigned_to_user_id: int | None,
    ) -> SupportTicket:
        if priority_value is not None:
            ticket.priority = priority_value
        if assigned_to_user_id is not None:
            ticket.assigned_to_user_id = assigned_to_user_id
        if status_value is not None:
            previous = ticket.status
            ticket.status = status_value
            # Solo el cierre definitivo registra la fecha de cierre.
            if status_value == SupportTicketStatus.closed:
                ticket.closed_at = ticket.closed_at or datetime.now(UTC)
            else:
                ticket.closed_at = None
            if status_value == SupportTicketStatus.resolved and previous != status_value:
                self._notify_owner(
                    db,
                    ticket,
                    notification_type="support_ticket_resolved",
                    title=f"Tu ticket {ticket.reference} fue marcado como resuelto",
                    body="Si necesitas algo más, puedes responder al ticket.",
                    action_label="Ver ticket",
                )
        ticket.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(ticket)
        return ticket

    # ------------------------------------------------------------------
    # Consultas
    # ------------------------------------------------------------------
    def list_my_tickets(self, db: Session, user: User) -> list[SupportTicket]:
        return (
            db.query(SupportTicket)
            .options(joinedload(SupportTicket.messages))
            .filter(SupportTicket.user_id == user.id)
            .order_by(SupportTicket.updated_at.desc(), SupportTicket.id.desc())
            .all()
        )

    def list_inbox(
        self,
        db: Session,
        *,
        status_value: SupportTicketStatus | None = None,
        category: SupportTicketCategory | None = None,
        priority_value: SupportTicketPriority | None = None,
        search: str | None = None,
    ) -> list[SupportTicket]:
        query = (
            db.query(SupportTicket)
            .options(joinedload(SupportTicket.messages), joinedload(SupportTicket.user))
        )
        if status_value is not None:
            query = query.filter(SupportTicket.status == status_value)
        if category is not None:
            query = query.filter(SupportTicket.category == category)
        if priority_value is not None:
            query = query.filter(SupportTicket.priority == priority_value)
        if search:
            like = f"%{search}%"
            query = query.join(User, User.id == SupportTicket.user_id).filter(
                or_(
                    SupportTicket.subject.ilike(like),
                    SupportTicket.reference.ilike(like),
                    User.email.ilike(like),
                )
            )
        return (
            query.order_by(
                SupportTicket.status.in_(_ACTIVE_STATUSES).desc(),
                SupportTicket.priority.desc(),
                SupportTicket.updated_at.desc(),
            )
            .limit(200)
            .all()
        )

    def open_count(self, db: Session) -> int:
        return (
            db.query(func.count(SupportTicket.id))
            .filter(SupportTicket.status.in_((SupportTicketStatus.open, SupportTicketStatus.in_progress)))
            .scalar()
            or 0
        )

    def get_ticket(self, db: Session, ticket_id: int) -> SupportTicket | None:
        return (
            db.query(SupportTicket)
            .options(
                joinedload(SupportTicket.messages).joinedload(SupportTicketMessage.attachments),
                joinedload(SupportTicket.messages).joinedload(SupportTicketMessage.author),
                joinedload(SupportTicket.user),
                joinedload(SupportTicket.assigned_to),
            )
            .filter(SupportTicket.id == ticket_id)
            .first()
        )

    def can_view(self, ticket: SupportTicket, user: User) -> bool:
        return ticket.user_id == user.id or user.is_admin or user.is_support

    # ------------------------------------------------------------------
    # Contexto y notificaciones
    # ------------------------------------------------------------------
    def _build_context(self, db: Session, *, user: User, context) -> dict:
        last_error = (
            db.query(ErrorLog)
            .filter(ErrorLog.user_id == user.id)
            .order_by(ErrorLog.created_at.desc(), ErrorLog.id.desc())
            .first()
        )
        return {
            "roles": [role.value for role in sorted_roles(user.roles)],
            "url": context.url if context else None,
            "user_agent": context.user_agent if context else None,
            "appointment_id": context.appointment_id if context else None,
            "video_session_id": context.video_session_id if context else None,
            "last_error_id": last_error.id if last_error else None,
            "last_error_message": last_error.message if last_error else None,
            "last_error_at": last_error.created_at.isoformat()
            if last_error and last_error.created_at
            else None,
        }

    def _support_user_ids(self, db: Session, *, exclude_user_id: int | None = None) -> list[int]:
        query = (
            db.query(UserRoleAssignment.user_id)
            .filter(
                UserRoleAssignment.role.in_((UserRole.support, UserRole.admin))
            )
            .distinct()
        )
        ids = [row[0] for row in query.all()]
        if exclude_user_id is not None:
            ids = [user_id for user_id in ids if user_id != exclude_user_id]
        return ids

    def _notify_support(self, db: Session, ticket: SupportTicket, *, reply: bool = False) -> None:
        for user_id in self._support_user_ids(db, exclude_user_id=ticket.user_id):
            notification_service.create(
                db,
                user_id=user_id,
                notification_type="support_ticket_reply" if reply else "support_ticket_created",
                title=(
                    f"Respuesta en {ticket.reference}"
                    if reply
                    else f"Nuevo ticket {ticket.reference}"
                ),
                body=ticket.subject,
                action_url=f"/support/tickets?ticket={ticket.id}",
                metadata={"ticket_id": ticket.id, "action_label": "Ver ticket"},
            )

    def _notify_owner(
        self,
        db: Session,
        ticket: SupportTicket,
        *,
        notification_type: str,
        title: str,
        body: str,
        action_label: str,
    ) -> None:
        notification_service.create(
            db,
            user_id=ticket.user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            action_url=f"/help?ticket={ticket.id}",
            metadata={"ticket_id": ticket.id, "action_label": action_label},
        )

    # ------------------------------------------------------------------
    # Serializadores
    # ------------------------------------------------------------------
    def serialize_ticket(self, ticket: SupportTicket) -> dict:
        messages = list(ticket.messages or [])
        last = messages[-1] if messages else None
        return {
            "id": ticket.id,
            "reference": ticket.reference,
            "subject": ticket.subject,
            "category": ticket.category,
            "status": ticket.status,
            "priority": ticket.priority,
            "user_id": ticket.user_id,
            "user_email": ticket.user.email if ticket.user else None,
            "user_name": _display_name(ticket.user),
            "message_count": len(messages),
            "last_message_preview": (last.body[:140] if last else None),
            "created_at": ticket.created_at,
            "updated_at": ticket.updated_at,
            "closed_at": ticket.closed_at,
        }

    def serialize_detail(self, ticket: SupportTicket) -> dict:
        context = None
        if ticket.context_json:
            try:
                context = json.loads(ticket.context_json)
            except ValueError:
                context = {"raw": ticket.context_json}
        base = self.serialize_ticket(ticket)
        base.update(
            {
                "context": context,
                "related_appointment_id": ticket.related_appointment_id,
                "related_video_session_id": ticket.related_video_session_id,
                "assigned_to_user_id": ticket.assigned_to_user_id,
                "assigned_to_email": ticket.assigned_to.email if ticket.assigned_to else None,
                "messages": [self.serialize_message(m) for m in sorted(ticket.messages, key=lambda m: m.id)],
            }
        )
        return base

    def serialize_message(self, message: SupportTicketMessage) -> dict:
        return {
            "id": message.id,
            "author_role": message.author_role,
            "author_user_id": message.author_user_id,
            "author_name": (
                "Soporte SabioDoc"
                if message.author_role == SupportTicketAuthorRole.support
                else _display_name(message.author)
            ),
            "body": message.body,
            "attachments": [
                {
                    "id": attachment.id,
                    "original_name": attachment.original_name,
                    "content_type": attachment.content_type,
                    "bytes": attachment.bytes,
                    "url": attachment.url,
                    "secure_url": attachment.secure_url,
                }
                for attachment in message.attachments
            ],
            "created_at": message.created_at,
        }


support_ticket_service = SupportTicketService()
