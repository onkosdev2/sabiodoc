import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.appointment import AppointmentStatus
from app.models.consultation import ConsultationStatus
from app.models.doctor_presence import DoctorPresenceStatus
from app.models.doctor_profile import DoctorProfile
from app.models.user import User, UserRole
from app.models.video_session import VideoSession, VideoSessionStatus
from app.models.video_session_event import VideoSessionEvent
from app.schemas.video_session import (
    VideoSessionCompleteRequest,
    VideoSessionDoctorNoteRequest,
    VideoSessionStatusResponse,
)
from app.services.audit_service import audit_service
from app.services.notification_service import notification_service

router = APIRouter(prefix="/video-sessions", tags=["video-sessions"])


def _resolve_participant_role(video_session: VideoSession, current_user: User) -> str:
    if video_session.patient_id == current_user.id:
        return "patient"
    if video_session.doctor and video_session.doctor.user_id == current_user.id:
        return "doctor"
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes acceder a esta videoconsulta")


def _sync_doctor_presence_from_video_sessions(db: Session, doctor_id: int) -> None:
    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_id).first()
    if not doctor_profile or not doctor_profile.presence:
        return

    active_or_prepared = (
        db.query(VideoSession)
        .filter(
            VideoSession.doctor_id == doctor_id,
            VideoSession.status.in_([VideoSessionStatus.prepared, VideoSessionStatus.active]),
        )
        .order_by(VideoSession.started_at.desc().nullslast(), VideoSession.created_at.desc())
        .all()
    )
    now = datetime.now(timezone.utc)
    active_or_prepared = [
        item
        for item in active_or_prepared
        if item.status != VideoSessionStatus.prepared or item.expires_at > now
    ]

    if any(item.status == VideoSessionStatus.active for item in active_or_prepared):
        doctor_profile.presence.status = DoctorPresenceStatus.busy
        doctor_profile.presence.status_message = "En videoconsulta"
    elif active_or_prepared:
        doctor_profile.presence.status = DoctorPresenceStatus.busy
        doctor_profile.presence.status_message = "Sala preparada"
    else:
        doctor_profile.presence.status = DoctorPresenceStatus.online
        doctor_profile.presence.status_message = "En linea - Disponible ahora"
    doctor_profile.presence.last_seen_at = now


def _expire_if_needed(db: Session, video_session: VideoSession) -> None:
    now = datetime.now(timezone.utc)
    if video_session.status == VideoSessionStatus.prepared and video_session.expires_at <= now:
        video_session.status = VideoSessionStatus.expired
        video_session.ended_at = video_session.ended_at or now
        _sync_doctor_presence_from_video_sessions(db, video_session.doctor_id)
        db.commit()
        db.refresh(video_session)


def _serialize_status(video_session: VideoSession, participant_role: str) -> VideoSessionStatusResponse:
    reference_end = video_session.ended_at or datetime.now(timezone.utc)
    elapsed_seconds = 0
    if video_session.started_at:
        elapsed_seconds = max(0, int((reference_end - video_session.started_at).total_seconds()))

    target_seconds = max(0, video_session.estimated_minutes * 60)
    remaining_seconds = max(0, target_seconds - elapsed_seconds)
    is_overtime = elapsed_seconds > target_seconds if target_seconds else False

    return VideoSessionStatusResponse(
        video_session_id=video_session.id,
        consultation_id=video_session.consultation_id,
        appointment_id=video_session.appointment_id,
        patient_id=video_session.patient_id,
        patient_email=video_session.patient.email if video_session.patient else "",
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
        elapsed_seconds=elapsed_seconds,
        remaining_seconds=remaining_seconds,
        is_overtime=is_overtime,
        doctor_note=video_session.doctor_note,
        followup_instructions=video_session.followup_instructions,
        closed_reason=video_session.closed_reason,
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
    return _serialize_status(video_session, participant_role)


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
    if current_user.role == UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="El admin no puede entrar a la sala")
    if video_session.status in {VideoSessionStatus.completed, VideoSessionStatus.cancelled, VideoSessionStatus.expired, VideoSessionStatus.failed}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta videoconsulta ya no esta disponible")

    now = datetime.now(timezone.utc)
    if video_session.expires_at <= now and video_session.status == VideoSessionStatus.prepared:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La videoconsulta ya expiro")

    if video_session.started_at is None:
        video_session.started_at = now
    video_session.status = VideoSessionStatus.active
    if participant_role == "patient":
        video_session.joined_patient_at = video_session.joined_patient_at or now
        if video_session.appointment:
            video_session.appointment.joined_patient_at = video_session.appointment.joined_patient_at or now
    else:
        video_session.joined_doctor_at = video_session.joined_doctor_at or now
        if video_session.appointment:
            video_session.appointment.joined_doctor_at = video_session.appointment.joined_doctor_at or now

    presence = video_session.doctor.presence if video_session.doctor else None
    if presence:
        presence.status = DoctorPresenceStatus.busy
        presence.status_message = "En videoconsulta"
        presence.last_seen_at = now

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
    return _serialize_status(video_session, participant_role)


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
    return _serialize_status(video_session, participant_role)


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
    video_session.status = VideoSessionStatus.completed
    video_session.ended_at = video_session.ended_at or now
    video_session.ended_by_user_id = current_user.id
    video_session.closed_reason = payload.closed_reason or "completed_by_doctor"
    video_session.doctor_note = payload.doctor_note
    video_session.followup_instructions = payload.followup_instructions
    if video_session.started_at:
        video_session.billable_seconds = max(
            video_session.billable_seconds or 0,
            int((video_session.ended_at - video_session.started_at).total_seconds()),
        )

    if video_session.appointment:
        appointment = video_session.appointment
        appointment.status = AppointmentStatus.completed
        appointment.completed_at = appointment.completed_at or now
        appointment.doctor_note = payload.doctor_note
        appointment.followup_instructions = payload.followup_instructions
        if appointment.consultation:
            appointment.consultation.status = ConsultationStatus.closed
            appointment.consultation.closed_at = appointment.consultation.closed_at or now
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
    return _serialize_status(video_session, participant_role)
