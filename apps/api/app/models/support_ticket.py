import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class SupportTicketCategory(str, enum.Enum):
    account = "account"
    payments = "payments"
    video = "video"
    app_error = "app_error"
    other = "other"


class SupportTicketStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    waiting_user = "waiting_user"
    resolved = "resolved"
    closed = "closed"


class SupportTicketPriority(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"


class SupportTicketAuthorRole(str, enum.Enum):
    user = "user"
    support = "support"
    system = "system"


class SupportTicket(Base):
    """Ticket de soporte enviado por un paciente o médico."""

    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    # Referencia legible para el usuario, p. ej. TCK-00123.
    reference = Column(String(20), unique=True, index=True, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    category = Column(
        Enum(SupportTicketCategory), nullable=False, default=SupportTicketCategory.other
    )
    status = Column(
        Enum(SupportTicketStatus), nullable=False, default=SupportTicketStatus.open, index=True
    )
    priority = Column(
        Enum(SupportTicketPriority), nullable=False, default=SupportTicketPriority.normal, index=True
    )
    # Contexto enlazado para que soporte diagnostique sin preguntar.
    related_appointment_id = Column(
        Integer, ForeignKey("appointments.id"), nullable=True, index=True
    )
    related_video_session_id = Column(
        Integer, ForeignKey("video_sessions.id"), nullable=True, index=True
    )
    last_error_id = Column(Integer, ForeignKey("error_logs.id"), nullable=True)
    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    context_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_user_id])
    messages = relationship(
        "SupportTicketMessage",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="SupportTicketMessage.id",
    )


class SupportTicketMessage(Base):
    """Mensaje dentro de un ticket (usuario, soporte o sistema)."""

    __tablename__ = "support_ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(
        Integer, ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    author_role = Column(Enum(SupportTicketAuthorRole), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("SupportTicket", back_populates="messages")
    author = relationship("User", foreign_keys=[author_user_id])
    attachments = relationship(
        "SupportTicketAttachment", back_populates="message", cascade="all, delete-orphan"
    )


class SupportTicketAttachment(Base):
    """Adjunto de un ticket (subido a Cloudinary; se guardan solo metadatos)."""

    __tablename__ = "support_ticket_attachments"

    id = Column(Integer, primary_key=True, index=True)
    # Nulos mientras el adjunto está subido pero aún no vinculado a un ticket/mensaje.
    ticket_id = Column(
        Integer, ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    message_id = Column(
        Integer,
        ForeignKey("support_ticket_messages.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    uploader_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    original_name = Column(String(255), nullable=False)
    content_type = Column(String(120), nullable=True)
    resource_type = Column(String(30), nullable=False)
    file_format = Column(String(20), nullable=True)
    bytes = Column(Integer, nullable=False, server_default="0")
    url = Column(String(1000), nullable=False)
    secure_url = Column(String(1000), nullable=False)
    public_id = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("SupportTicket")
    message = relationship("SupportTicketMessage", back_populates="attachments")
    uploader = relationship("User", foreign_keys=[uploader_id])
