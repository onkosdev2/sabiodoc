import uuid
from datetime import UTC, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.specialty import Specialty
from app.models.consultation import Consultation, ConsultationStatus
from app.models.appointment import Appointment
from app.models.video_session import VideoSession
from app.models.patient_profile import PatientProfile
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
from app.services.patient_profile_service import build_patient_context
from app.services.consultation_service import close_stale_consultations
from app.services.video_session_service import video_session_service
from app.core.logging import get_logger

router = APIRouter(prefix="/consultations", tags=["consultations"])
logger = get_logger(__name__)


def serialize_consultation(consultation: Consultation, last_activity_at=None) -> ConsultationResponse:
    response = ConsultationResponse.model_validate(consultation)
    if consultation.specialty:
        response.specialty = SpecialtyResponse.model_validate(consultation.specialty)
    if consultation.intake_json:
        response.intake = ConsultationStructuredIntake.model_validate(consultation.intake_json)
    response.last_activity_at = last_activity_at or consultation.closed_at or consultation.created_at
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

    # Cerrar borradores inactivos antes de validar conflictos: una consulta
    # vieja sin actividad no debe bloquear la creación de una nueva.
    close_stale_consultations(db, user_id=current_user.id)

    # Puede existir una consulta en curso **por especialidad**: debe finalizarse
    # (resumen generado o cierre manual) antes de crear otra de la misma área.
    # Así, una consulta de Cardiología no bloquea una nueva de Dermatología.
    open_consultation = (
        db.query(Consultation)
        .filter(
            Consultation.user_id == current_user.id,
            Consultation.specialty_id == data.specialty_id,
            Consultation.status.in_([ConsultationStatus.created, ConsultationStatus.active]),
        )
        .order_by(Consultation.created_at.desc())
        .first()
    )
    if open_consultation:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": (
                    f"Ya tienes una consulta en curso de {specialty.name}. "
                    "Finalízala antes de crear otra de la misma especialidad."
                ),
                "consultation_id": open_consultation.id,
            },
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
    close_stale_consultations(db, user_id=current_user.id)

    consultations = (
        db.query(Consultation)
        .filter(Consultation.user_id == current_user.id)
        .order_by(Consultation.created_at.desc())
        .all()
    )

    # Última actividad por consulta (último mensaje), en una sola query para
    # evitar N+1. Si no hay mensajes se usa la fecha de creación.
    last_activity_by_id: dict[int, datetime] = {}
    if consultations:
        rows = (
            db.query(ChatMessage.consultation_id, func.max(ChatMessage.created_at))
            .filter(ChatMessage.consultation_id.in_([c.id for c in consultations]))
            .group_by(ChatMessage.consultation_id)
            .all()
        )
        last_activity_by_id = {consultation_id: last_at for consultation_id, last_at in rows}

    result = [
        serialize_consultation(c, last_activity_by_id.get(c.id))
        for c in consultations
    ]
    
    return ConsultationListResponse(
        consultations=result,
        total=len(result)
    )


@router.post("/{consultation_id}/close", response_model=ConsultationResponse)
def close_consultation(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Finaliza manualmente una consulta abierta (borrador o activa)."""
    consultation = (
        db.query(Consultation)
        .filter(Consultation.id == consultation_id, Consultation.user_id == current_user.id)
        .with_for_update()
        .first()
    )
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consulta no encontrada",
        )

    if consultation.status != ConsultationStatus.closed:
        consultation.status = ConsultationStatus.closed
        consultation.auto_closed = False
        consultation.closed_at = datetime.now(UTC)
        db.commit()
        db.refresh(consultation)

    logger.info(f"Consultation closed by user: id={consultation_id}")
    return serialize_consultation(consultation)


@router.delete("/{consultation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_consultation(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Elimina un borrador (consulta creada y nunca usada clínicamente).

    Para proteger el historial clínico solo se permiten borradores: una consulta
    activa o finalizada debe conservarse. Tampoco se elimina si tiene una cita o
    videoconsulta vinculada.
    """
    consultation = (
        db.query(Consultation)
        .filter(Consultation.id == consultation_id, Consultation.user_id == current_user.id)
        .first()
    )
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consulta no encontrada",
        )

    if consultation.status != ConsultationStatus.created:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Solo puedes eliminar borradores. Finaliza la consulta para "
                "conservarla en tu historial."
            ),
        )

    if db.query(Appointment.id).filter(Appointment.consultation_id == consultation_id).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este borrador tiene una cita vinculada y no se puede eliminar.",
        )
    if db.query(VideoSession.id).filter(VideoSession.consultation_id == consultation_id).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este borrador tiene una videoconsulta vinculada y no se puede eliminar.",
        )

    db.query(ChatMessage).filter(ChatMessage.consultation_id == consultation_id).delete(
        synchronize_session=False
    )
    db.delete(consultation)
    db.commit()

    logger.info(f"Draft consultation deleted: id={consultation_id}")
    return None


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

    # Guardarraíl: el asistente solo atiende temas de la pre-consulta médica.
    guard = specialist_assistant.guard_response(data.message)
    if guard is not None:
        assistant_message = ChatMessage(
            consultation_id=consultation_id,
            role=MessageRole.assistant,
            content=guard,
        )
        db.add(assistant_message)
        db.commit()
        db.refresh(assistant_message)
        return ChatResponse(
            user_message=ChatMessageResponse.model_validate(user_message),
            assistant_message=ChatMessageResponse.model_validate(assistant_message),
        )

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
    # Incluimos el perfil del paciente para que la IA no repita datos conocidos
    # y dé respuestas más precisas.
    patient_profile = (
        db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    )
    patient_context = build_patient_context(patient_profile, current_user.email)

    assistant_response = specialist_assistant.chat(
        specialty_slug=specialty.slug,
        specialty_name=specialty.name,
        messages=message_history,
        patient_context=patient_context,
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
        .with_for_update()
        .first()
    )
    
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consulta no encontrada"
        )
    
    # Verificar si ya hay mensajes (el lock evita duplicar la bienvenida si
    # el frontend llama a este endpoint dos veces de forma concurrente).
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
    
    # Guardar resultados en la consulta y finalizarla (la pre-consulta terminó).
    consultation.summary = summary
    consultation.intake_json = intake
    consultation.status = ConsultationStatus.closed
    consultation.closed_at = datetime.now(UTC)
    db.commit()
    db.refresh(consultation)
    
    logger.info(f"Summary generated for consultation {consultation_id}")
    
    return GenerateSummaryResponse(
        summary=summary,
        consultation_id=consultation_id,
        intake=ConsultationStructuredIntake.model_validate(intake),
    )


@router.post("/{consultation_id}/close", response_model=ConsultationResponse)
def close_consultation(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Finaliza manualmente la pre-consulta para poder iniciar otra."""
    consultation = (
        db.query(Consultation)
        .filter(Consultation.id == consultation_id, Consultation.user_id == current_user.id)
        .first()
    )
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consulta no encontrada",
        )

    if consultation.status != ConsultationStatus.closed:
        consultation.status = ConsultationStatus.closed
        consultation.closed_at = datetime.now(UTC)
        db.commit()
        db.refresh(consultation)
        logger.info(f"Consultation closed: id={consultation_id}")

    return serialize_consultation(consultation)


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
