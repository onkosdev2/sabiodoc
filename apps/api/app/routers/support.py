"""Tickets de soporte: envío por pacientes/médicos y bandeja para soporte."""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_admin_or_support
from app.core.rate_limit import rate_limit_dependency
from app.models.support_ticket import (
    SupportTicketCategory,
    SupportTicketPriority,
    SupportTicketStatus,
)
from app.models.user import User
from app.schemas.support_ticket import (
    SupportAttachmentResponse,
    SupportTicketCreate,
    SupportTicketDetailResponse,
    SupportTicketListResponse,
    SupportTicketMessageResponse,
    SupportTicketReply,
    SupportTicketUpdateRequest,
)
from app.services.support_ticket_service import support_ticket_service

router = APIRouter(prefix="/support", tags=["support"])

create_ticket_rate_limit = rate_limit_dependency(
    "support:create-ticket", max_requests=10, window_seconds=3600
)


# ---------------------------------------------------------------------------
# Adjuntos
# ---------------------------------------------------------------------------
@router.post(
    "/attachments",
    response_model=SupportAttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_support_attachment(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sube un adjunto (imagen/PDF) para usarlo en un ticket."""
    return support_ticket_service.upload_attachment(db, uploader=current_user, upload=file)


# ---------------------------------------------------------------------------
# Tickets del usuario (paciente/médico)
# ---------------------------------------------------------------------------
@router.post(
    "/tickets",
    response_model=SupportTicketDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(create_ticket_rate_limit)],
)
def create_support_ticket(
    payload: SupportTicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = support_ticket_service.create_ticket(
        db,
        user=current_user,
        subject=payload.subject,
        category=payload.category,
        message=payload.message,
        attachment_ids=payload.attachment_ids,
        context=payload.context,
    )
    return support_ticket_service.serialize_detail(ticket)


@router.get("/tickets", response_model=SupportTicketListResponse)
def list_my_support_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tickets = support_ticket_service.list_my_tickets(db, current_user)
    open_count = sum(
        1
        for ticket in tickets
        if ticket.status
        in (SupportTicketStatus.open, SupportTicketStatus.in_progress, SupportTicketStatus.waiting_user)
    )
    return SupportTicketListResponse(
        tickets=[support_ticket_service.serialize_ticket(ticket) for ticket in tickets],
        total=len(tickets),
        open_count=open_count,
    )


@router.get("/tickets/{ticket_id}", response_model=SupportTicketDetailResponse)
def get_support_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = support_ticket_service.get_ticket(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado")
    if not support_ticket_service.can_view(ticket, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes ver este ticket")
    return support_ticket_service.serialize_detail(ticket)


@router.post(
    "/tickets/{ticket_id}/messages",
    response_model=SupportTicketMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def reply_support_ticket(
    ticket_id: int,
    payload: SupportTicketReply,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = support_ticket_service.get_ticket(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado")
    if not support_ticket_service.can_view(ticket, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes responder este ticket")
    message = support_ticket_service.add_message(
        db,
        ticket=ticket,
        author=current_user,
        body=payload.message,
        attachment_ids=payload.attachment_ids,
    )
    return support_ticket_service.serialize_message(message)


# ---------------------------------------------------------------------------
# Bandeja de soporte (rol Soporte o admin)
# ---------------------------------------------------------------------------
@router.get("/inbox", response_model=SupportTicketListResponse)
def list_support_inbox(
    status_filter: SupportTicketStatus | None = Query(default=None),
    category: SupportTicketCategory | None = Query(default=None),
    priority: SupportTicketPriority | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_support),
):
    tickets = support_ticket_service.list_inbox(
        db,
        status_value=status_filter,
        category=category,
        priority_value=priority,
        search=search,
    )
    return SupportTicketListResponse(
        tickets=[support_ticket_service.serialize_ticket(ticket) for ticket in tickets],
        total=len(tickets),
        open_count=support_ticket_service.open_count(db),
    )


@router.patch("/inbox/{ticket_id}", response_model=SupportTicketDetailResponse)
def update_support_ticket(
    ticket_id: int,
    payload: SupportTicketUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_support),
):
    ticket = support_ticket_service.get_ticket(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado")
    if payload.assigned_to_user_id is not None:
        assignee = db.query(User).filter(User.id == payload.assigned_to_user_id).first()
        if not assignee:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El responsable no existe")
    support_ticket_service.update_ticket(
        db,
        ticket=ticket,
        status_value=payload.status,
        priority_value=payload.priority,
        assigned_to_user_id=payload.assigned_to_user_id,
    )
    return support_ticket_service.serialize_detail(ticket)
