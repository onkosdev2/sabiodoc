import json
import math
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.config import settings
from app.core.logging import get_logger
from app.models.appointment import AppointmentStatus
from app.models.consultation import ConsultationStatus
from app.models.user import User
from app.models.video_session import VideoSession, VideoSessionStatus
from app.models.video_session_event import VideoSessionEvent
from app.schemas.video_session import (
    VideoSessionCompleteRequest,
    VideoSessionDoctorNoteRequest,
    VideoSessionStatusResponse,
)
from app.services.audit_service import audit_service
from app.services.notification_service import notification_service
from app.services.patient_profile_service import get_patient_display_name
from app.services.video_session_service import video_session_service
from app.services.wallet_service import wallet_service

router = APIRouter(prefix="/video-sessions", tags=["video-sessions"])
logger = get_logger(__name__)


def _resolve_participant_role(video_session: VideoSession, current_user: User) -> str:
    if video_session.patient_id == current_user.id:
        return "patient"
    if video_session.doctor and video_session.doctor.user_id == current_user.id:
        return "doctor"
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes acceder a esta videoconsulta")


def _sync_doctor_presence_from_video_sessions(db: Session, doctor_id: int) -> None:
    video_session_service.sync_doctor_presence(db, doctor_id)


def _expire_if_needed(db: Session, video_session: VideoSession) -> None:
    if video_session_service.expire_session_if_stale(db, video_session):
        video_session_service.sync_doctor_presence(db, video_session.doctor_id)


def _heartbeat_and_reconcile(db: Session, video_session: VideoSession, participant_role: str) -> None:
    """Registra la presencia del que consulta y pausa el cronometro si falta alguien.

    Durante el tiempo extra consume creditos del paciente; si se queda sin saldo,
    termina la videollamada de inmediato.
    """
    if video_session.status not in {VideoSessionStatus.prepared, VideoSessionStatus.active}:
        return
    now = datetime.now(timezone.utc)
    video_session_service.touch_participant(video_session, participant_role, now)
    video_session_service.reconcile_timer(video_session, now)
    if video_session.status == VideoSessionStatus.active:
        if not video_session_service.process_overtime_billing(db, video_session, now):
            video_session_service.terminate_for_no_credits(db, video_session, now)
    db.commit()
    db.refresh(video_session)


def _serialize_status(
    video_session: VideoSession,
    participant_role: str,
    *,
    patient_balance_cents: int = 0,
    overtime_amount_cents: int = 0,
) -> VideoSessionStatusResponse:
    reference_end = video_session.ended_at or datetime.now(timezone.utc)
    billable_seconds = video_session.billable_seconds or 0
    elapsed_seconds = billable_seconds
    if video_session.started_at:
        elapsed_seconds += max(0, int((reference_end - video_session.started_at).total_seconds()))

    target_seconds = max(0, video_session.estimated_minutes * 60)
    remaining_seconds = max(0, target_seconds - elapsed_seconds)
    is_overtime = elapsed_seconds > target_seconds if target_seconds else False

    price_per_min_cents = video_session.doctor_price_per_min_cents or 0
    held_amount_cents = video_session.prepaid_amount_cents or 0
    billable_minutes_total = (
        max(settings.VIDEO_MIN_BILLABLE_MINUTES, math.ceil(elapsed_seconds / 60))
        if elapsed_seconds > 0
        else 0
    )
    if elapsed_seconds > 0:
        # Costo real acumulado de la sesión (lo retenido se muestra aparte).
        # No lo limitamos a la retención: en citas sin pago adelantado seguiría
        # marcando 0 y no reflejaría el tiempo transcurrido.
        current_cost_cents = billable_minutes_total * price_per_min_cents
    else:
        current_cost_cents = 0

    scheduled_minutes = video_session.estimated_minutes or 0
    overtime_minutes = max(0, billable_minutes_total - scheduled_minutes)
    can_afford_overtime = price_per_min_cents > 0 and patient_balance_cents >= price_per_min_cents
    if overtime_minutes <= 0:
        billing_mode = "scheduled"
    elif can_afford_overtime:
        billing_mode = "overtime"
    else:
        billing_mode = "exhausted"

    now = datetime.now(timezone.utc)
    patient_present = video_session_service.participant_present(video_session, "patient", now)
    doctor_present = video_session_service.participant_present(video_session, "doctor", now)
    both_present = patient_present and doctor_present

    return VideoSessionStatusResponse(
        video_session_id=video_session.id,
        consultation_id=video_session.consultation_id,
        appointment_id=video_session.appointment_id,
        patient_id=video_session.patient_id,
        patient_email=video_session.patient.email if video_session.patient else "",
        patient_name=get_patient_display_name(video_session.patient),
        status=video_session.status,
        provider=video_session.provider,
        participant_role=participant_role,
        room_name=video_session.provider_room_name,
        started_at=video_session.started_at,
        ended_at=video_session.ended_at,
        joined_patient_at=video_session.joined_patient_at,
        joined_doctor_at=video_session.joined_doctor_at,
        expires_at=video_session.expires_at,
        estimated_minutes=video_session.estimated_minutes,
        billable_seconds=billable_seconds,
        elapsed_seconds=elapsed_seconds,
        remaining_seconds=remaining_seconds,
        is_overtime=is_overtime,
        price_per_min_cents=price_per_min_cents,
        held_amount_cents=held_amount_cents,
        current_cost_cents=current_cost_cents,
        overtime_amount_cents=overtime_amount_cents,
        patient_balance_cents=patient_balance_cents,
        can_afford_overtime=can_afford_overtime,
        billing_mode=billing_mode,
        patient_present=patient_present,
        doctor_present=doctor_present,
        both_present=both_present,
        doctor_note=video_session.doctor_note,
        followup_instructions=video_session.followup_instructions,
        intro_script=video_session.intro_script,
        closed_reason=video_session.closed_reason,
    )


def _serialize_status_with_billing(
    db: Session, video_session: VideoSession, participant_role: str
) -> VideoSessionStatusResponse:
    """Carga saldo del paciente y tiempo extra ya consumido antes de serializar."""
    patient_balance_cents = 0
    overtime_amount_cents = 0
    appointment = video_session.appointment
    if appointment is not None:
        payment = wallet_service.get_appointment_payment(db, appointment.id)
        if payment is not None:
            overtime_amount_cents = payment.overtime_amount_cents or 0
        patient_balance_cents = wallet_service.get_balance_cents(db, appointment.patient_id)
    return _serialize_status(
        video_session,
        participant_role,
        patient_balance_cents=patient_balance_cents,
        overtime_amount_cents=overtime_amount_cents,
    )


@router.get("/{video_session_id}", response_model=VideoSessionStatusResponse)
def get_video_session_status(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    _expire_if_needed(db, video_session)
    participant_role = _resolve_participant_role(video_session, current_user)
    _heartbeat_and_reconcile(db, video_session, participant_role)
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/join", response_model=VideoSessionStatusResponse)
def join_video_session(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    _expire_if_needed(db, video_session)
    participant_role = _resolve_participant_role(video_session, current_user)
    if video_session.status in {VideoSessionStatus.completed, VideoSessionStatus.cancelled, VideoSessionStatus.expired, VideoSessionStatus.failed}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta videoconsulta ya no esta disponible")

    # Entrar a la sala NO inicia el cronometro: solo registra la conexion y la
    # presencia. El tiempo de consulta lo controla el medico (iniciar/pausar/finalizar)
    # y solo corre cuando ambos estan presentes.
    now = datetime.now(timezone.utc)
    video_session_service.set_participant_presence(video_session, participant_role, True, now)
    if participant_role == "patient":
        video_session.joined_patient_at = video_session.joined_patient_at or now
        if video_session.appointment:
            video_session.appointment.joined_patient_at = video_session.appointment.joined_patient_at or now
    else:
        video_session.joined_doctor_at = video_session.joined_doctor_at or now
        if video_session.appointment:
            video_session.appointment.joined_doctor_at = video_session.appointment.joined_doctor_at or now

    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="participant_joined_app",
            source="backend",
            payload_json=json.dumps({"participant_role": participant_role, "user_id": current_user.id}),
        )
    )
    _sync_doctor_presence_from_video_sessions(db, video_session.doctor_id)
    db.commit()
    db.refresh(video_session)
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/intro", response_model=VideoSessionStatusResponse)
def generate_video_session_intro(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Genera (o recupera) el guion de apertura de la videoconsulta. Solo el medico."""
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el medico puede ver el guion de apertura",
        )
    if video_session.status in {
        VideoSessionStatus.completed,
        VideoSessionStatus.cancelled,
        VideoSessionStatus.expired,
        VideoSessionStatus.failed,
    }:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta videoconsulta ya no esta disponible")

    video_session_service.generate_intro_script(db, video_session)
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/start", response_model=VideoSessionStatusResponse)
def start_video_session_timer(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Inicia (o reanuda) el cronometro de la videoconsulta. Solo el medico."""
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el medico puede controlar el cronometro de la videoconsulta",
        )
    if video_session.status in {
        VideoSessionStatus.completed,
        VideoSessionStatus.cancelled,
        VideoSessionStatus.expired,
        VideoSessionStatus.failed,
    }:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta videoconsulta ya no esta disponible")

    now = datetime.now(timezone.utc)
    video_session_service.touch_participant(video_session, "doctor", now)
    # Limpia primero cualquier tiempo con presencia incompleta.
    video_session_service.reconcile_timer(video_session, now)
    if not video_session_service.both_participants_present(video_session, now):
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Para iniciar la consulta, el paciente y el medico deben estar en la sala",
        )
    if video_session.started_at is None:
        video_session.started_at = now
    # Al iniciar, garantizamos que la sala siga vigente durante la consulta
    # (duracion estimada + margen); asi no se expira una sesion legitima.
    minimum_expiry = now + timedelta(minutes=video_session.estimated_minutes + 60)
    if video_session.expires_at < minimum_expiry:
        video_session.expires_at = minimum_expiry
    video_session.status = VideoSessionStatus.active
    _sync_doctor_presence_from_video_sessions(db, video_session.doctor_id)
    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="video_session_timer_started",
            source="backend",
            payload_json=json.dumps({"user_id": current_user.id}),
        )
    )
    db.commit()
    db.refresh(video_session)
    logger.info(f"Video session {video_session_id} timer started by doctor (user={current_user.id})")
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/pause", response_model=VideoSessionStatusResponse)
def pause_video_session_timer(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pausa el cronometro acumulando el tiempo transcurrido. Solo el medico."""
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el medico puede controlar el cronometro de la videoconsulta",
        )

    now = datetime.now(timezone.utc)
    video_session_service.touch_participant(video_session, "doctor", now)
    video_session_service.pause_timer(video_session, now)
    video_session_service.process_overtime_billing(db, video_session, now)
    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="video_session_timer_paused",
            source="backend",
            payload_json=json.dumps({"user_id": current_user.id}),
        )
    )
    db.commit()
    db.refresh(video_session)
    logger.info(f"Video session {video_session_id} timer paused by doctor (user={current_user.id})")
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/leave", response_model=VideoSessionStatusResponse)
def leave_video_session(
    video_session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pausa la sesión al salir de la sala.

    Acumula el tiempo conectado en ``billable_seconds`` y limpia ``started_at``
    para que el cronómetro y el cobro se detengan hasta que se vuelva a entrar.
    """
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    participant_role = _resolve_participant_role(video_session, current_user)

    now = datetime.now(timezone.utc)
    # El cronometro solo corre con ambos presentes: al salir cualquiera de los
    # dos, se pausa y se acumula unicamente el tiempo en el que ambos estuvieron.
    video_session_service.set_participant_presence(video_session, participant_role, False, now)
    video_session_service.pause_timer(video_session, now)
    video_session_service.process_overtime_billing(db, video_session, now)

    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="participant_left_app",
            source="backend",
            payload_json=json.dumps({"participant_role": participant_role, "user_id": current_user.id}),
        )
    )
    db.commit()
    db.refresh(video_session)
    logger.info(f"Video session {video_session_id} paused by {participant_role} (user={current_user.id})")
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.patch("/{video_session_id}/doctor-note", response_model=VideoSessionStatusResponse)
def update_video_session_doctor_note(
    video_session_id: int,
    payload: VideoSessionDoctorNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "doctor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el medico puede actualizar notas clinicas")

    video_session.doctor_note = payload.doctor_note
    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="doctor_note_updated",
            source="backend",
            payload_json=json.dumps({"user_id": current_user.id}),
        )
    )
    audit_service.log(
        db,
        action="video_session.doctor_note_updated",
        entity_type="video_session",
        entity_id=video_session.id,
        actor_user_id=current_user.id,
    )
    db.commit()
    db.refresh(video_session)
    return _serialize_status_with_billing(db, video_session, participant_role)


@router.post("/{video_session_id}/complete", response_model=VideoSessionStatusResponse)
def complete_video_session(
    video_session_id: int,
    payload: VideoSessionCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video_session = db.query(VideoSession).filter(VideoSession.id == video_session_id).first()
    if not video_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Videoconsulta no encontrada")

    participant_role = _resolve_participant_role(video_session, current_user)
    if participant_role != "doctor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el medico puede cerrar la videoconsulta")
    if video_session.status in {VideoSessionStatus.completed, VideoSessionStatus.cancelled, VideoSessionStatus.expired, VideoSessionStatus.failed}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta videoconsulta ya fue cerrada")

    now = datetime.now(timezone.utc)
    video_session_service.reconcile_timer(video_session, now)
    video_session_service.pause_timer(video_session, now)
    video_session_service.process_overtime_billing(db, video_session, now)
    video_session.patient_present = False
    video_session.doctor_present = False
    video_session.status = VideoSessionStatus.completed
    video_session.ended_at = video_session.ended_at or now
    video_session.ended_by_user_id = current_user.id
    video_session.closed_reason = payload.closed_reason or "completed_by_doctor"
    video_session.doctor_note = payload.doctor_note
    video_session.followup_instructions = payload.followup_instructions

    if video_session.appointment:
        appointment = video_session.appointment
        appointment.status = AppointmentStatus.completed
        appointment.completed_at = appointment.completed_at or now
        appointment.doctor_note = payload.doctor_note
        appointment.followup_instructions = payload.followup_instructions
        if appointment.consultation:
            appointment.consultation.status = ConsultationStatus.closed
            appointment.consultation.closed_at = appointment.consultation.closed_at or now
        # Cobro real segun el tiempo efectivo; el resto se devuelve al paciente.
        wallet_service.release_appointment(
            db,
            appointment,
            billable_seconds=video_session.billable_seconds or 0,
        )
        notification_service.create(
            db,
            user_id=appointment.patient_id,
            notification_type="appointment_completed",
            title="Videoconsulta completada",
            body=f"Tu videoconsulta con {video_session.doctor.display_name} finalizo. Ya puedes revisar indicaciones y dejar una reseña.",
            action_url="/me/appointments",
            metadata={"appointment_id": appointment.id, "action_label": "Ver cita"},
        )
    elif video_session.consultation:
        consultation = video_session.consultation
        consultation.status = ConsultationStatus.closed
        consultation.closed_at = consultation.closed_at or now
        notification_service.create(
            db,
            user_id=video_session.patient_id,
            notification_type="video_consultation_completed",
            title="Videoconsulta finalizada",
            body=f"La videoconsulta con {video_session.doctor.display_name} ya finalizo.",
            action_url="/me/consultations",
            metadata={"consultation_id": consultation.id, "action_label": "Ver consulta"},
        )

    db.add(
        VideoSessionEvent(
            video_session_id=video_session.id,
            event_type="video_session_completed_by_doctor",
            source="backend",
            payload_json=json.dumps({"user_id": current_user.id, "closed_reason": video_session.closed_reason}),
        )
    )
    audit_service.log(
        db,
        action="video_session.completed",
        entity_type="video_session",
        entity_id=video_session.id,
        actor_user_id=current_user.id,
        metadata={"closed_reason": video_session.closed_reason},
    )
    _sync_doctor_presence_from_video_sessions(db, video_session.doctor_id)
    db.commit()
    db.refresh(video_session)
    return _serialize_status_with_billing(db, video_session, participant_role)
