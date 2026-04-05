from datetime import UTC, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.appointment import Appointment, AppointmentStatus
from app.models.consultation import Consultation
from app.models.doctor_availability_slot import DoctorAvailabilitySlot
from app.models.doctor_presence import DoctorPresence, DoctorPresenceStatus
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.doctor_specialty import DoctorSpecialty
from app.models.notification import Notification, NotificationStatus
from app.models.specialty import Specialty
from app.models.user import User, UserRole
from app.models.video_session import VideoSession, VideoSessionStatus
from app.schemas.appointment import (
    DoctorAvailabilityResponse,
    DoctorAvailabilitySlotResponse,
    DoctorAvailabilityUpsertRequest,
    DoctorBookableSlotListResponse,
    DoctorBookableSlotResponse,
    DoctorDashboardMetricCard,
    DoctorDashboardResponse,
    AdminLiveVideoSessionResponse,
)
from app.schemas.doctor import (
    DoctorApplicationListResponse,
    DoctorApplicationResponse,
    DoctorApplicationStatusUpdate,
    DoctorCardResponse,
    DoctorListResponse,
    DoctorPatientTimelineItemResponse,
    DoctorPatientTimelineResponse,
    DoctorPresenceResponse,
    DoctorProfileUpsertRequest,
    DoctorPresenceUpdate,
)
from app.schemas.video_session import DoctorVideoSessionListResponse, DoctorVideoSessionResponse
from app.services.appointment_service import appointment_service
from app.services.audit_service import audit_service
from app.services.daily_service import daily_service
from app.services.doctor_onboarding_service import doctor_onboarding_service
from app.services.notification_service import notification_service
from app.services.reminder_service import reminder_service

router = APIRouter(prefix="/doctors", tags=["doctors"])
logger = get_logger(__name__)


def _get_approved_doctor_profile_or_403(db: Session, current_user: User) -> DoctorProfile:
    if current_user.role != UserRole.doctor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo los medicos pueden acceder a este recurso")

    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not doctor_profile or doctor_profile.status != DoctorApprovalStatus.approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tu perfil medico aun no esta aprobado")
    return doctor_profile


def _doctor_can_view_patient_history(db: Session, doctor_profile_id: int, patient_id: int) -> bool:
    has_appointment = (
        db.query(Appointment.id)
        .filter(Appointment.doctor_id == doctor_profile_id, Appointment.patient_id == patient_id)
        .first()
        is not None
    )
    if has_appointment:
        return True

    has_video_session = (
        db.query(VideoSession.id)
        .filter(VideoSession.doctor_id == doctor_profile_id, VideoSession.patient_id == patient_id)
        .first()
        is not None
    )
    return has_video_session


@router.get("/specialty/{slug}", response_model=DoctorListResponse)
def list_doctors_by_specialty(slug: str, db: Session = Depends(get_db)):
    specialty = db.query(Specialty).filter(Specialty.slug == slug).first()
    if not specialty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Especialidad no encontrada")

    doctor_profiles = (
        db.query(DoctorProfile)
        .join(DoctorSpecialty, DoctorSpecialty.doctor_id == DoctorProfile.id)
        .filter(
            DoctorSpecialty.specialty_id == specialty.id,
            DoctorProfile.status == DoctorApprovalStatus.approved,
            DoctorProfile.is_accepting_consultations == True,
        )
        .order_by(DoctorProfile.rating_avg.desc(), DoctorProfile.rating_count.desc(), DoctorProfile.display_name.asc())
        .all()
    )

    doctors = []
    for profile in doctor_profiles:
        presence = profile.presence
        if not presence:
            presence = DoctorPresence(
                status=DoctorPresenceStatus.offline,
                status_message="Desconectado",
                last_seen_at=datetime.now(timezone.utc),
            )
        doctors.append(
            DoctorCardResponse(
                id=profile.id,
                user_id=profile.user_id,
                display_name=profile.display_name,
                professional_title=profile.professional_title,
                bio_short=profile.bio_short,
                price_per_min_cents=profile.price_per_min_cents,
                rating_avg=profile.rating_avg,
                rating_count=profile.rating_count,
                is_accepting_consultations=profile.is_accepting_consultations,
                status=profile.status,
                presence=DoctorPresenceResponse.model_validate(presence),
            )
        )

    return DoctorListResponse(doctors=doctors, total=len(doctors))


@router.post("/presence", response_model=DoctorPresenceResponse)
def update_my_presence(
    payload: DoctorPresenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.doctor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo los medicos pueden actualizar presencia")

    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not doctor_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil medico no encontrado")
    if doctor_profile.status != DoctorApprovalStatus.approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tu perfil medico aun no esta aprobado")

    presence = doctor_profile.presence
    if not presence:
        presence = DoctorPresence(doctor_id=doctor_profile.id)
        db.add(presence)

    presence.status = payload.status
    presence.status_message = payload.status_message
    presence.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(presence)
    logger.info(f"Doctor presence updated: doctor_profile_id={doctor_profile.id}, status={presence.status.value}")

    return DoctorPresenceResponse.model_validate(presence)


@router.put("/me/profile", response_model=DoctorCardResponse)
def upsert_my_doctor_profile(
    payload: DoctorProfileUpsertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.doctor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo los medicos pueden editar perfil medico")

    doctor_onboarding_service.validate_price_or_raise(payload.price_per_min_cents)

    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not doctor_profile:
        doctor_profile = DoctorProfile(
            user_id=current_user.id,
            display_name=payload.display_name,
            professional_title=payload.professional_title,
            bio_short=payload.bio_short,
            price_per_min_cents=payload.price_per_min_cents,
            license_number=payload.license_number,
            license_country=payload.license_country,
            country=payload.country,
            city=payload.city,
            timezone=payload.timezone,
            government_id=payload.government_id,
            years_experience=payload.years_experience,
            status=DoctorApprovalStatus.pending,
        )
        db.add(doctor_profile)
        db.flush()

    doctor_profile.display_name = payload.display_name
    doctor_profile.professional_title = payload.professional_title
    doctor_profile.bio_short = payload.bio_short
    doctor_profile.price_per_min_cents = payload.price_per_min_cents
    doctor_profile.license_number = payload.license_number
    doctor_profile.license_country = payload.license_country
    doctor_profile.country = payload.country
    doctor_profile.city = payload.city
    doctor_profile.timezone = payload.timezone
    doctor_profile.government_id = payload.government_id
    doctor_profile.years_experience = payload.years_experience
    doctor_profile.is_accepting_consultations = True
    if not getattr(doctor_profile, "status", None):
        doctor_profile.status = DoctorApprovalStatus.pending
    elif doctor_profile.status in {DoctorApprovalStatus.rejected, DoctorApprovalStatus.suspended}:
        doctor_profile.status = DoctorApprovalStatus.pending
        doctor_profile.review_notes = None

    doctor_onboarding_service.sync_specialties(db, doctor_profile, payload.specialty_ids)
    presence = doctor_onboarding_service.ensure_presence(db, doctor_profile)
    presence.last_seen_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(doctor_profile)
    db.refresh(presence)

    logger.info(f"Doctor profile upserted: doctor_profile_id={doctor_profile.id}, specialties={len(set(payload.specialty_ids))}")
    return DoctorCardResponse(
        id=doctor_profile.id,
        user_id=doctor_profile.user_id,
        display_name=doctor_profile.display_name,
        professional_title=doctor_profile.professional_title,
        bio_short=doctor_profile.bio_short,
        price_per_min_cents=doctor_profile.price_per_min_cents,
        rating_avg=doctor_profile.rating_avg,
        rating_count=doctor_profile.rating_count,
        is_accepting_consultations=doctor_profile.is_accepting_consultations,
        status=doctor_profile.status,
        presence=DoctorPresenceResponse.model_validate(presence),
    )


@router.get("/me/application", response_model=DoctorApplicationResponse)
def get_my_doctor_application(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.doctor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo los medicos pueden ver su postulacion")

    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not doctor_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Postulacion medica no encontrada")

    return doctor_onboarding_service.build_application_response_from_relations(doctor_profile)


@router.get("/applications", response_model=DoctorApplicationListResponse)
def list_doctor_applications(
    review_status: DoctorApprovalStatus | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo los administradores pueden revisar postulaciones")

    query = db.query(DoctorProfile).order_by(DoctorProfile.created_at.desc())
    if review_status:
        query = query.filter(DoctorProfile.status == review_status)

    applications = query.all()
    return DoctorApplicationListResponse(
        applications=[
            doctor_onboarding_service.build_application_response_from_relations(application)
            for application in applications
        ],
        total=len(applications),
    )


@router.post("/applications/{doctor_id}/status", response_model=DoctorApplicationResponse)
def update_doctor_application_status(
    doctor_id: int,
    payload: DoctorApplicationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo los administradores pueden actualizar postulaciones")

    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_id).first()
    if not doctor_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Postulacion medica no encontrada")

    doctor_profile.status = payload.status
    doctor_profile.review_notes = payload.review_notes
    notification_service.create(
        db,
        user_id=doctor_profile.user_id,
        notification_type="doctor_application_reviewed",
        title="Actualizacion de postulacion médica",
        body=f"Tu perfil medico fue marcado como {payload.status.value}.",
        action_url="/doctor/pending",
        metadata={"doctor_id": doctor_profile.id, "status": payload.status.value},
    )
    audit_service.log(
        db,
        action="doctor_application.reviewed",
        entity_type="doctor_profile",
        entity_id=doctor_profile.id,
        actor_user_id=current_user.id,
        metadata={"status": payload.status.value},
    )
    db.commit()
    db.refresh(doctor_profile)

    logger.info(f"Doctor application reviewed: doctor_profile_id={doctor_profile.id}, status={doctor_profile.status.value}")
    return doctor_onboarding_service.build_application_response_from_relations(doctor_profile)


@router.get("/me/availability", response_model=DoctorAvailabilityResponse)
def get_my_availability(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.doctor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo los medicos pueden ver disponibilidad")
    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not doctor_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil medico no encontrado")
    slots = sorted(doctor_profile.availability_slots, key=lambda item: (item.weekday, item.start_time))
    return DoctorAvailabilityResponse(
        timezone=doctor_profile.timezone or "UTC",
        slots=[DoctorAvailabilitySlotResponse.model_validate(slot) for slot in slots],
    )


@router.put("/me/availability", response_model=DoctorAvailabilityResponse)
def upsert_my_availability(
    payload: DoctorAvailabilityUpsertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.doctor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo los medicos pueden editar disponibilidad")
    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not doctor_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil medico no encontrado")

    timezone_info = appointment_service.get_timezone(payload.timezone)
    del timezone_info
    appointment_service.validate_slots(payload.slots)

    db.query(DoctorAvailabilitySlot).filter(DoctorAvailabilitySlot.doctor_id == doctor_profile.id).delete()
    db.flush()
    for slot in payload.slots:
        db.add(
            DoctorAvailabilitySlot(
                doctor_id=doctor_profile.id,
                weekday=slot.weekday,
                start_time=slot.start_time,
                end_time=slot.end_time,
                is_active=slot.is_active,
            )
        )
    doctor_profile.timezone = payload.timezone
    audit_service.log(
        db,
        action="doctor_availability.updated",
        entity_type="doctor_profile",
        entity_id=doctor_profile.id,
        actor_user_id=current_user.id,
        metadata={"slots": len(payload.slots), "timezone": payload.timezone},
    )
    db.commit()
    db.refresh(doctor_profile)
    slots = sorted(doctor_profile.availability_slots, key=lambda item: (item.weekday, item.start_time))
    return DoctorAvailabilityResponse(
        timezone=doctor_profile.timezone or "UTC",
        slots=[DoctorAvailabilitySlotResponse.model_validate(slot) for slot in slots],
    )


@router.get("/me/dashboard", response_model=DoctorDashboardResponse)
def get_doctor_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor_profile = _get_approved_doctor_profile_or_403(db, current_user)
    reminder_service.process_due_reminders(db)

    now = datetime.now(UTC)
    upcoming = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_profile.id,
            Appointment.status == AppointmentStatus.scheduled,
            Appointment.scheduled_at >= now,
        )
        .order_by(Appointment.scheduled_at.asc())
        .limit(5)
        .all()
    )
    recent_completed = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_profile.id,
            Appointment.status == AppointmentStatus.completed,
        )
        .order_by(Appointment.completed_at.desc())
        .limit(5)
        .all()
    )
    unread_notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.status == NotificationStatus.unread)
        .count()
    )
    total_scheduled = (
        db.query(Appointment)
        .filter(Appointment.doctor_id == doctor_profile.id, Appointment.status == AppointmentStatus.scheduled)
        .count()
    )
    total_completed = (
        db.query(Appointment)
        .filter(Appointment.doctor_id == doctor_profile.id, Appointment.status == AppointmentStatus.completed)
        .count()
    )
    average_rating = float(doctor_profile.rating_avg or 0)
    active_video_sessions = (
        db.query(VideoSession)
        .filter(
            VideoSession.doctor_id == doctor_profile.id,
            VideoSession.status.in_([VideoSessionStatus.prepared, VideoSessionStatus.active]),
        )
        .order_by(VideoSession.created_at.desc())
        .limit(5)
        .all()
    )
    metrics = [
        DoctorDashboardMetricCard(key="scheduled", label="Citas programadas", value=str(total_scheduled)),
        DoctorDashboardMetricCard(key="completed", label="Consultas completadas", value=str(total_completed)),
        DoctorDashboardMetricCard(key="rating", label="Rating promedio", value=f"{average_rating:.1f}"),
        DoctorDashboardMetricCard(key="notifications", label="Notificaciones sin leer", value=str(unread_notifications)),
    ]
    return DoctorDashboardResponse(
        metrics=metrics,
        upcoming_appointments=[appointment_service.serialize_appointment(item) for item in upcoming],
        recent_completed_appointments=[appointment_service.serialize_appointment(item) for item in recent_completed],
        active_video_sessions=[
            AdminLiveVideoSessionResponse(
                video_session_id=session.id,
                appointment_id=session.appointment_id,
                consultation_id=session.consultation_id,
                doctor_name=doctor_profile.display_name,
                patient_email=session.patient.email if session.patient else "",
                status=session.status.value,
                started_at=session.started_at,
                expires_at=session.expires_at,
                joined_patient_at=session.joined_patient_at,
                joined_doctor_at=session.joined_doctor_at,
            )
            for session in active_video_sessions
        ],
        unread_notifications=unread_notifications,
        average_rating=average_rating,
    )


@router.get("/patients/{patient_id}/timeline", response_model=DoctorPatientTimelineResponse)
def get_patient_timeline_for_doctor(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor_profile = _get_approved_doctor_profile_or_403(db, current_user)
    patient = db.query(User).filter(User.id == patient_id, User.role == UserRole.patient).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")

    if not _doctor_can_view_patient_history(db, doctor_profile.id, patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes ver el historial de pacientes con relacion clinica previa o cita agendada",
        )

    consultation_items = []
    consultations = (
        db.query(Consultation)
        .filter(Consultation.user_id == patient_id)
        .order_by(Consultation.created_at.desc())
        .all()
    )
    for consultation in consultations:
        consultation_items.append(
            DoctorPatientTimelineItemResponse(
                item_type="consultation",
                sort_at=consultation.closed_at or consultation.created_at,
                specialty_id=consultation.specialty_id,
                specialty_name=consultation.specialty.name if consultation.specialty else "Especialidad",
                consultation_id=consultation.id,
                consultation_status=consultation.status,
                summary=consultation.summary,
                intake=consultation.intake_json,
                created_at=consultation.created_at,
            )
        )

    appointment_items = []
    appointments = (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient_id, Appointment.doctor_id == doctor_profile.id)
        .order_by(Appointment.scheduled_at.desc())
        .all()
    )
    for appointment in appointments:
        review = appointment.review[0] if appointment.review else None
        appointment_items.append(
            DoctorPatientTimelineItemResponse(
                item_type="appointment",
                sort_at=appointment.completed_at or appointment.scheduled_at,
                specialty_id=appointment.specialty_id,
                specialty_name=appointment.specialty.name if appointment.specialty else "Especialidad",
                consultation_id=appointment.consultation_id,
                appointment_id=appointment.id,
                appointment_status=appointment.status,
                summary=appointment.ai_summary_snapshot,
                intake=appointment.ai_intake_snapshot_json,
                patient_note=appointment.patient_note,
                doctor_note=appointment.doctor_note,
                followup_instructions=appointment.followup_instructions,
                review_rating=review.rating if review else None,
                review_comment=review.comment if review else None,
                scheduled_at=appointment.scheduled_at,
                completed_at=appointment.completed_at,
                created_at=appointment.created_at,
            )
        )

    items = sorted([*appointment_items, *consultation_items], key=lambda item: item.sort_at, reverse=True)
    return DoctorPatientTimelineResponse(
        patient_id=patient.id,
        patient_email=patient.email,
        doctor_id=doctor_profile.id,
        can_view_history=True,
        items=items,
        total=len(items),
    )


@router.get("/{doctor_id}/bookable-slots", response_model=DoctorBookableSlotListResponse)
def get_doctor_bookable_slots(
    doctor_id: int,
    days: int = Query(default=14, ge=1, le=30),
    duration_minutes: int = Query(default=30, ge=15, le=120),
    db: Session = Depends(get_db),
):
    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_id).first()
    if not doctor_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medico no encontrado")
    if doctor_profile.status != DoctorApprovalStatus.approved or not doctor_profile.is_accepting_consultations:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El medico no esta disponible para nuevas citas")
    slots = appointment_service.compute_bookable_slots(
        db,
        doctor_profile=doctor_profile,
        days=days,
        duration_minutes=duration_minutes,
    )
    return DoctorBookableSlotListResponse(
        timezone=doctor_profile.timezone or "UTC",
        slots=[
            DoctorBookableSlotResponse(starts_at=starts_at, ends_at=ends_at, duration_minutes=duration_minutes)
            for starts_at, ends_at in slots
        ],
        total=len(slots),
    )


@router.get("/me/video-sessions", response_model=DoctorVideoSessionListResponse)
def get_my_video_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor_profile = _get_approved_doctor_profile_or_403(db, current_user)

    sessions = (
        db.query(VideoSession)
        .filter(VideoSession.doctor_id == doctor_profile.id)
        .order_by(VideoSession.created_at.desc())
        .all()
    )

    now = datetime.now(UTC)
    result = []
    for session in sessions:
        if session.status not in {VideoSessionStatus.prepared, VideoSessionStatus.active}:
            continue
        if session.expires_at <= now:
            if session.status == VideoSessionStatus.prepared:
                session.status = VideoSessionStatus.expired
            continue

        try:
            doctor_token = daily_service.create_meeting_token(
                room_name=session.provider_room_name,
                owner_id=doctor_profile.id,
                role="doctor",
                expires_at=session.expires_at,
            )
        except Exception as exc:
            logger.warning(
                f"Skipping video session {session.id} for doctor {doctor_profile.id} due to token error: {exc}"
            )
            continue

        result.append(
            DoctorVideoSessionResponse(
                video_session_id=session.id,
                consultation_id=session.consultation_id,
                appointment_id=session.appointment_id,
                patient_id=session.patient_id,
                status=session.status,
                provider=session.provider,
                room_name=session.provider_room_name,
                room_url=session.provider_room_url,
                doctor_token=doctor_token,
                doctor_price_per_min_cents=session.doctor_price_per_min_cents,
                estimated_minutes=session.estimated_minutes,
                prepaid_amount_cents=session.prepaid_amount_cents,
                expires_at=session.expires_at,
                created_at=session.created_at,
                patient_email=session.patient.email,
                specialty_name=(
                    session.consultation.specialty.name
                    if session.consultation and session.consultation.specialty
                    else session.appointment.specialty.name
                    if session.appointment and session.appointment.specialty
                    else "Especialidad"
                ),
            )
        )

    db.commit()
    return DoctorVideoSessionListResponse(sessions=result, total=len(result))
