import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.specialty import Specialty
from app.models.consultation import Consultation, ConsultationStatus
from app.models.chat_message import ChatMessage, MessageRole
from app.schemas.consultation import (
    ConsultationCreate,
    ConsultationListResponse,
    ConsultationResponse,
    ConsultationStructuredIntake,
)
from app.schemas.specialty import SpecialtyResponse
from app.schemas.chat import (
    ChatRequest, ChatResponse, ChatMessageResponse, 
    ChatHistoryResponse, GenerateSummaryResponse
)
from app.schemas.video_session import VideoSessionPrepareRequest, VideoSessionPrepareResponse
from app.services.specialist_assistant import specialist_assistant
from app.services.video_session_service import video_session_service
from app.core.logging import get_logger

router = APIRouter(prefix="/consultations", tags=["consultations"])
logger = get_logger(__name__)


def serialize_consultation(consultation: Consultation) -> ConsultationResponse:
    response = ConsultationResponse.model_validate(consultation)
    if consultation.specialty:
        response.specialty = SpecialtyResponse.model_validate(consultation.specialty)
    if consultation.intake_json:
        response.intake = ConsultationStructuredIntake.model_validate(consultation.intake_json)
    return response


@router.post("", response_model=ConsultationResponse, status_code=status.HTTP_201_CREATED)
def create_consultation(
    data: ConsultationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    specialty = db.query(Specialty).filter(Specialty.id == data.specialty_id).first()
    if not specialty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Especialidad no encontrada"
        )
    
    room_id = f"sabiodoc-{uuid.uuid4()}"
    
    consultation = Consultation(
        user_id=current_user.id,
        specialty_id=data.specialty_id,
        room_id=room_id
    )
    db.add(consultation)
    db.commit()
    db.refresh(consultation)
    
    logger.info(f"Consultation created: id={consultation.id}, room_id={room_id}")
    
    return serialize_consultation(consultation)


@router.get("/my", response_model=ConsultationListResponse)
def get_my_consultations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    consultations = (
        db.query(Consultation)
        .filter(Consultation.user_id == current_user.id)
        .order_by(Consultation.created_at.desc())
        .all()
    )
    
    result = []
    for c in consultations:
        result.append(serialize_consultation(c))
    
    return ConsultationListResponse(
        consultations=result,
        total=len(result)
    )


@router.get("/{consultation_id}", response_model=ConsultationResponse)
def get_consultation(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener una consulta específica por ID."""
    consultation = (
        db.query(Consultation)
        .filter(Consultation.id == consultation_id, Consultation.user_id == current_user.id)
        .first()
    )
    
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consulta no encontrada"
        )
    
    return serialize_consultation(consultation)


@router.get("/{consultation_id}/messages", response_model=ChatHistoryResponse)
def get_chat_history(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener el historial de chat de una consulta."""
    consultation = (
        db.query(Consultation)
        .filter(Consultation.id == consultation_id, Consultation.user_id == current_user.id)
        .first()
    )
    
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consulta no encontrada"
        )
    
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.consultation_id == consultation_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    
    return ChatHistoryResponse(
        messages=[ChatMessageResponse.model_validate(m) for m in messages],
        consultation_id=consultation_id,
        specialty_name=consultation.specialty.name if consultation.specialty else "Especialidad"
    )


@router.post("/{consultation_id}/chat", response_model=ChatResponse)
def chat_with_assistant(
    consultation_id: int,
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Enviar un mensaje al asistente IA especializado.
    El asistente responde según la especialidad de la consulta.
    """
    consultation = (
        db.query(Consultation)
        .filter(Consultation.id == consultation_id, Consultation.user_id == current_user.id)
        .first()
    )
    
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consulta no encontrada"
        )
    
    if consultation.status == ConsultationStatus.closed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta consulta ya está cerrada"
        )
    
    # Actualizar estado a activo si es la primera interacción
    if consultation.status == ConsultationStatus.created:
        consultation.status = ConsultationStatus.active
    
    # Guardar mensaje del usuario
    user_message = ChatMessage(
        consultation_id=consultation_id,
        role=MessageRole.user,
        content=data.message
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)
    
    # Obtener historial de mensajes para contexto
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.consultation_id == consultation_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    
    # Convertir a formato para el asistente
    message_history = [
        {"role": m.role.value, "content": m.content}
        for m in messages
    ]
    
    # Obtener respuesta del asistente especializado
    specialty = consultation.specialty
    assistant_response = specialist_assistant.chat(
        specialty_slug=specialty.slug,
        specialty_name=specialty.name,
        messages=message_history
    )
    
    # Guardar respuesta del asistente
    assistant_message = ChatMessage(
        consultation_id=consultation_id,
        role=MessageRole.assistant,
        content=assistant_response
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    
    logger.info(f"Chat exchange in consultation {consultation_id}")
    
    return ChatResponse(
        user_message=ChatMessageResponse.model_validate(user_message),
        assistant_message=ChatMessageResponse.model_validate(assistant_message)
    )


@router.post("/{consultation_id}/start-chat", response_model=ChatMessageResponse)
def start_chat(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Iniciar el chat con el asistente IA.
    Retorna el mensaje de bienvenida del asistente.
    """
    consultation = (
        db.query(Consultation)
        .filter(Consultation.id == consultation_id, Consultation.user_id == current_user.id)
        .first()
    )
    
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consulta no encontrada"
        )
    
    # Verificar si ya hay mensajes
    existing_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.consultation_id == consultation_id)
        .count()
    )
    
    if existing_messages > 0:
        # Retornar el primer mensaje del asistente
        first_message = (
            db.query(ChatMessage)
            .filter(
                ChatMessage.consultation_id == consultation_id,
                ChatMessage.role == MessageRole.assistant
            )
            .order_by(ChatMessage.created_at.asc())
            .first()
        )
        if first_message:
            return ChatMessageResponse.model_validate(first_message)
    
    # Generar mensaje de bienvenida
    specialty = consultation.specialty
    welcome_message = specialist_assistant.chat(
        specialty_slug=specialty.slug,
        specialty_name=specialty.name,
        messages=[]  # Sin historial = mensaje de bienvenida
    )
    
    # Guardar mensaje de bienvenida
    assistant_message = ChatMessage(
        consultation_id=consultation_id,
        role=MessageRole.assistant,
        content=welcome_message
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    
    logger.info(f"Chat started for consultation {consultation_id}")
    
    return ChatMessageResponse.model_validate(assistant_message)


@router.post("/{consultation_id}/generate-summary", response_model=GenerateSummaryResponse)
def generate_consultation_summary(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generar un resumen de la pre-consulta para el médico.
    """
    consultation = (
        db.query(Consultation)
        .filter(Consultation.id == consultation_id, Consultation.user_id == current_user.id)
        .first()
    )
    
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consulta no encontrada"
        )
    
    # Obtener historial de mensajes
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.consultation_id == consultation_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    
    if len(messages) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay suficientes mensajes para generar un resumen"
        )
    
    # Convertir a formato para el asistente
    message_history = [
        {"role": m.role.value, "content": m.content}
        for m in messages
    ]
    
    # Generar resumen estructurado y ficha de intake
    specialty = consultation.specialty
    summary = specialist_assistant.generate_summary(
        specialty_slug=specialty.slug,
        specialty_name=specialty.name,
        messages=message_history
    )
    intake = specialist_assistant.generate_structured_intake(
        specialty_slug=specialty.slug,
        specialty_name=specialty.name,
        messages=message_history,
    )
    
    # Guardar resultados en la consulta
    consultation.summary = summary
    consultation.intake_json = intake
    db.commit()
    
    logger.info(f"Summary generated for consultation {consultation_id}")
    
    return GenerateSummaryResponse(
        summary=summary,
        consultation_id=consultation_id,
        intake=ConsultationStructuredIntake.model_validate(intake),
    )


@router.post("/{consultation_id}/video-session/prepare", response_model=VideoSessionPrepareResponse)
def prepare_video_session(
    consultation_id: int,
    data: VideoSessionPrepareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    consultation = (
        db.query(Consultation)
        .filter(Consultation.id == consultation_id, Consultation.user_id == current_user.id)
        .first()
    )

    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consulta no encontrada"
        )

    result = video_session_service.prepare_session(
        db=db,
        consultation=consultation,
        patient_id=current_user.id,
        doctor_profile_id=data.doctor_id,
        estimated_minutes=data.estimated_minutes,
        payment_method_id=data.payment_method_id,
    )

    logger.info(f"Video session prepared: consultation_id={consultation_id}, doctor_profile_id={data.doctor_id}")
    return VideoSessionPrepareResponse(**result)
