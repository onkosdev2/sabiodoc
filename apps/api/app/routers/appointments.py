from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.appointment import Appointment, AppointmentStatus
from app.models.consultation import Consultation, ConsultationStatus
from app.models.consultation_review import ConsultationReview
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.user import User, UserRole
from app.schemas.appointment import (
    AppointmentCancelRequest,
    AppointmentCompleteRequest,
    AppointmentCreateRequest,
    AppointmentListResponse,
    AppointmentNoShowRequest,
    AppointmentRescheduleRequest,
    AppointmentResponse,
    AppointmentReviewCreateRequest,
)
from app.schemas.video_session import AppointmentVideoSessionResponse
from app.services.appointment_service import appointment_service
from app.services.audit_service import audit_service
from app.services.notification_service import notification_service
from app.services.reminder_service import reminder_service
from app.services.video_session_service import video_session_service

router = APIRouter(prefix="/appointments", tags=["appointments"])
logger = get_logger(__name__)


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.id == payload.doctor_id).first()
    if not doctor_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medico no encontrado")

    consultation = None
    specialty_id = payload.specialty_id
    if payload.consultation_id:
        consultation = (
            db.query(Consultation)
            .filter(Consultation.id == payload.consultation_id, Consultation.user_id == current_user.id)
            .first()
        )
        if not consultation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consulta no encontrada")
        specialty_id = consultation.specialty_id

    if specialty_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debe indicar la especialidad o una consulta previa")
    if not payload.accepted_terms:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes aceptar el consentimiento y terminos de la videoconsulta")

    scheduled_at = payload.scheduled_at.astimezone(UTC)
    if scheduled_at <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cita debe programarse en el futuro")

    appointment_service.ensure_bookable_doctor(doctor_profile, specialty_id)
    appointment_service.ensure_slot_matches_availability(
        doctor_profile=doctor_profile,
        scheduled_at=scheduled_at,
        duration_minutes=payload.duration_minutes,
    )
    appointment_service.ensure_no_overlap(
        db,
        doctor_id=doctor_profile.id,
        scheduled_at=scheduled_at,
        duration_minutes=payload.duration_minutes,
    )

    ai_summary_snapshot = appointment_service.build_ai_summary_snapshot(db, consultation)
    ai_intake_snapshot = appointment_service.build_ai_intake_snapshot(db, consultation)
    appointment = Appointment(
        consultation_id=consultation.id if consultation else None,
        specialty_id=specialty_id,
        patient_id=current_user.id,
        doctor_id=doctor_profile.id,
        scheduled_at=scheduled_at,
        duration_minutes=payload.duration_minutes,
        patient_note=payload.patient_note,
        ai_summary_snapshot=ai_summary_snapshot,
        ai_intake_snapshot_json=ai_intake_snapshot,
        booked_via_ai=consultation is not None,
        consent_accepted_at=datetime.now(UTC),
        consent_text_version=payload.consent_text_version,
    )
    db.add(appointment)
    db.flush()

    notification_service.create(
        db,
        user_id=current_user.id,
        notification_type="appointment_scheduled",
        title="Cita agendada",
        body=f"Tu cita con {doctor_profile.display_name} fue agendada para {scheduled_at.astimezone(appointment_service.get_timezone(doctor_profile.timezone)).strftime('%d/%m %H:%M')}.",
        action_url="/me/appointments",
        metadata={"appointment_id": appointment.id, "action_label": "Ver cita"},
    )
    notification_service.create(
        db,
        user_id=doctor_profile.user_id,
        notification_type="appointment_booked",
        title="Nueva cita agendada",
        body=f"{current_user.email} agendo una cita contigo.",
        action_url="/doctor",
        metadata={"appointment_id": appointment.id, "action_label": "Abrir panel"},
    )
    audit_service.log(
        db,
        action="appointment.created",
        entity_type="appointment",
        entity_id=appointment.id,
        actor_user_id=current_user.id,
        metadata={"doctor_id": doctor_profile.id, "consultation_id": consultation.id if consultation else None},
    )
    db.commit()
    db.refresh(appointment)

    logger.info(f"Appointment created: id={appointment.id}, doctor={doctor_profile.id}, patient={current_user.id}")
    return appointment_service.serialize_appointment(appointment)


@router.get("/my", response_model=AppointmentListResponse)
def get_my_appointments(
    status_filter: AppointmentStatus | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reminder_service.process_due_reminders(db)
    query = db.query(Appointment).filter(Appointment.patient_id == current_user.id)
    if status_filter:
        query = query.filter(Appointment.status == status_filter)
    appointments = query.order_by(Appointment.scheduled_at.desc()).all()
    return AppointmentListResponse(
        appointments=[appointment_service.serialize_appointment(item) for item in appointments],
        total=len(appointments),
    )


@router.get("/doctor/my", response_model=AppointmentListResponse)
def get_my_doctor_appointments(
    status_filter: AppointmentStatus | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.doctor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo los medicos pueden ver esta agenda")
    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not doctor_profile or doctor_profile.status != DoctorApprovalStatus.approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tu perfil medico aun no esta aprobado")
    reminder_service.process_due_reminders(db)

    query = db.query(Appointment).filter(Appointment.doctor_id == doctor_profile.id)
    if status_filter:
        query = query.filter(Appointment.status == status_filter)
    appointments = query.order_by(Appointment.scheduled_at.asc()).all()
    return AppointmentListResponse(
        appointments=[appointment_service.serialize_appointment(item) for item in appointments],
        total=len(appointments),
    )


@router.get("/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
    if current_user.role != UserRole.admin and appointment.patient_id != current_user.id and appointment.doctor.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes ver esta cita")
    return appointment_service.serialize_appointment(appointment)


@router.post("/{appointment_id}/video-session/prepare", response_model=AppointmentVideoSessionResponse)
def prepare_appointment_video_session(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")

    return video_session_service.prepare_session_for_appointment(
        db=db,
        appointment=appointment,
        current_user=current_user,
    )


@router.post("/{appointment_id}/cancel", response_model=AppointmentResponse)
def cancel_appointment(
    appointment_id: int,
    payload: AppointmentCancelRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
    if appointment.status != AppointmentStatus.scheduled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se pueden cancelar citas programadas")
    if current_user.role != UserRole.admin and appointment.patient_id != current_user.id and appointment.doctor.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes cancelar esta cita")

    appointment.status = AppointmentStatus.cancelled
    appointment.cancelled_at = datetime.now(UTC)
    appointment.cancellation_reason = payload.reason if payload else None
    notification_service.create(
        db,
        user_id=appointment.patient_id,
        notification_type="appointment_cancelled",
        title="Cita cancelada",
        body=f"La cita con {appointment.doctor.display_name} fue cancelada.",
        action_url="/me/appointments",
        metadata={"appointment_id": appointment.id, "action_label": "Ver cita"},
    )
    notification_service.create(
        db,
        user_id=appointment.doctor.user_id,
        notification_type="appointment_cancelled",
        title="Cita cancelada",
        body=f"La cita con {appointment.patient.email} fue cancelada.",
        action_url="/doctor",
        metadata={"appointment_id": appointment.id, "action_label": "Abrir panel"},
    )
    audit_service.log(
        db,
        action="appointment.cancelled",
        entity_type="appointment",
        entity_id=appointment.id,
        actor_user_id=current_user.id,
        metadata={"reason": payload.reason if payload else None},
    )
    db.commit()
    db.refresh(appointment)
    return appointment_service.serialize_appointment(appointment)


@router.post("/{appointment_id}/reschedule", response_model=AppointmentResponse)
def reschedule_appointment(
    appointment_id: int,
    payload: AppointmentRescheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
    if appointment.status != AppointmentStatus.scheduled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se pueden reprogramar citas programadas")
    if current_user.role != UserRole.admin and appointment.patient_id != current_user.id and appointment.doctor.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes reprogramar esta cita")

    scheduled_at = payload.scheduled_at.astimezone(UTC)
    if scheduled_at <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cita debe programarse en el futuro")

    appointment_service.ensure_slot_matches_availability(
        doctor_profile=appointment.doctor,
        scheduled_at=scheduled_at,
        duration_minutes=payload.duration_minutes,
    )
    appointment_service.ensure_no_overlap(
        db,
        doctor_id=appointment.doctor_id,
        scheduled_at=scheduled_at,
        duration_minutes=payload.duration_minutes,
    )

    appointment.scheduled_at = scheduled_at
    appointment.duration_minutes = payload.duration_minutes
    appointment.day_reminder_sent_at = None
    appointment.hour_reminder_sent_at = None
    appointment.cancellation_reason = payload.reason
    notification_service.create(
        db,
        user_id=appointment.patient_id,
        notification_type="appointment_rescheduled",
        title="Cita reprogramada",
        body=f"Tu cita con {appointment.doctor.display_name} fue reprogramada para {scheduled_at.astimezone(appointment_service.get_timezone(appointment.doctor.timezone)).strftime('%d/%m %H:%M')}.",
        action_url="/me/appointments",
        metadata={"appointment_id": appointment.id, "action_label": "Ver cita"},
    )
    notification_service.create(
        db,
        user_id=appointment.doctor.user_id,
        notification_type="appointment_rescheduled",
        title="Cita reprogramada",
        body=f"La cita con {appointment.patient.email} fue reprogramada.",
        action_url="/doctor",
        metadata={"appointment_id": appointment.id, "action_label": "Abrir panel"},
    )
    audit_service.log(
        db,
        action="appointment.rescheduled",
        entity_type="appointment",
        entity_id=appointment.id,
        actor_user_id=current_user.id,
        metadata={"reason": payload.reason, "scheduled_at": scheduled_at.isoformat()},
    )
    db.commit()
    db.refresh(appointment)
    return appointment_service.serialize_appointment(appointment)


@router.post("/{appointment_id}/mark-no-show", response_model=AppointmentResponse)
def mark_appointment_no_show(
    appointment_id: int,
    payload: AppointmentNoShowRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
    if current_user.role not in {UserRole.admin, UserRole.doctor}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo medico o admin pueden marcar no-show")
    if current_user.role == UserRole.doctor and appointment.doctor.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes gestionar esta cita")
    if appointment.status != AppointmentStatus.scheduled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se puede marcar no-show sobre citas programadas")

    grace_time = appointment.scheduled_at + appointment_service.get_no_show_grace_delta()
    if datetime.now(UTC) < grace_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aun no termina el margen para marcar no-show")

    appointment.status = AppointmentStatus.no_show
    appointment.no_show_marked_at = datetime.now(UTC)
    appointment.cancellation_reason = payload.reason
    notification_service.create(
        db,
        user_id=appointment.patient_id,
        notification_type="appointment_no_show",
        title="Cita marcada como no-show",
        body="La cita fue cerrada por ausencia. Puedes reagendar cuando quieras.",
        action_url="/me/appointments",
        metadata={"appointment_id": appointment.id, "action_label": "Revisar cita"},
    )
    audit_service.log(
        db,
        action="appointment.no_show",
        entity_type="appointment",
        entity_id=appointment.id,
        actor_user_id=current_user.id,
        metadata={"reason": payload.reason},
    )
    db.commit()
    db.refresh(appointment)
    return appointment_service.serialize_appointment(appointment)


@router.post("/{appointment_id}/complete", response_model=AppointmentResponse)
def complete_appointment(
    appointment_id: int,
    payload: AppointmentCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.doctor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo los medicos pueden cerrar citas")
    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not doctor_profile or not appointment or appointment.doctor_id != doctor_profile.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
    if appointment.status != AppointmentStatus.scheduled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se pueden cerrar citas programadas")

    appointment.status = AppointmentStatus.completed
    appointment.completed_at = datetime.now(UTC)
    appointment.doctor_note = payload.doctor_note
    appointment.followup_instructions = payload.followup_instructions
    if appointment.consultation:
        appointment.consultation.status = ConsultationStatus.closed
        appointment.consultation.closed_at = datetime.now(UTC)

    notification_service.create(
        db,
        user_id=appointment.patient_id,
        notification_type="appointment_completed",
        title="Consulta completada",
        body=f"Tu consulta con {doctor_profile.display_name} finalizo. Ya puedes dejar una reseña.",
        action_url="/me/appointments",
        metadata={"appointment_id": appointment.id, "action_label": "Ver cita"},
    )
    audit_service.log(
        db,
        action="appointment.completed",
        entity_type="appointment",
        entity_id=appointment.id,
        actor_user_id=current_user.id,
    )
    db.commit()
    db.refresh(appointment)
    return appointment_service.serialize_appointment(appointment)


@router.post("/{appointment_id}/review", response_model=AppointmentResponse)
def create_review(
    appointment_id: int,
    payload: AppointmentReviewCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id, Appointment.patient_id == current_user.id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
    if appointment.status != AppointmentStatus.completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo puedes reseñar citas completadas")
    if appointment.review:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta cita ya tiene reseña")

    review = ConsultationReview(
        appointment_id=appointment.id,
        patient_id=current_user.id,
        doctor_id=appointment.doctor_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    doctor_profile = appointment.doctor
    total_reviews = doctor_profile.rating_count or 0
    current_average = float(doctor_profile.rating_avg or 0)
    doctor_profile.rating_avg = ((current_average * total_reviews) + payload.rating) / (total_reviews + 1)
    doctor_profile.rating_count = total_reviews + 1

    notification_service.create(
        db,
        user_id=doctor_profile.user_id,
        notification_type="appointment_review",
        title="Nueva reseña recibida",
        body=f"Recibiste una reseña de {payload.rating}/5 por una consulta completada.",
        action_url="/doctor",
        metadata={"appointment_id": appointment.id, "rating": payload.rating, "action_label": "Abrir panel"},
    )
    audit_service.log(
        db,
        action="appointment.reviewed",
        entity_type="appointment",
        entity_id=appointment.id,
        actor_user_id=current_user.id,
        metadata={"rating": payload.rating},
    )
    db.commit()
    db.refresh(appointment)
    return appointment_service.serialize_appointment(appointment)
