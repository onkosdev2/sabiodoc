from datetime import UTC, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.core.deps import get_current_user, get_db, get_doctor_profile_or_403, require_application_reviewer
from app.core.config import settings
from app.core.logging import get_logger
from app.models.appointment import Appointment, AppointmentStatus
from app.models.consultation import Consultation
from app.models.consultation_review import ConsultationReview
from app.models.doctor_availability_slot import DoctorAvailabilitySlot
from app.models.doctor_presence import DoctorPresence, DoctorPresenceStatus
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.doctor_specialty import DoctorSpecialty
from app.models.notification import Notification, NotificationStatus
from app.models.patient_profile import PatientProfile
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
    DoctorDetailResponse,
    DoctorListResponse,
    DoctorPatientListResponse,
    DoctorPatientSummary,
    DoctorPatientTimelineItemResponse,
    DoctorPatientTimelineResponse,
    DoctorPresenceResponse,
    DoctorProfileUpsertRequest,
    DoctorPresenceUpdate,
    DoctorReviewResponse,
    DoctorReviewsResponse,
    DoctorSpecialtySummary,
)
from app.schemas.patient import PatientProfileResponse
from app.schemas.patient_profile_change import (
    PatientProfileChangeRequestCreate,
    PatientProfileChangeRequestResponse,
)
from app.schemas.video_session import DoctorVideoSessionListResponse, DoctorVideoSessionResponse
from app.services.appointment_service import appointment_service
from app.services.audit_service import audit_service
from app.services.jitsi_service import jitsi_service
from app.services.doctor_onboarding_service import doctor_onboarding_service
from app.services.notification_service import notification_service
from app.services.patient_profile_service import get_patient_display_name, serialize_patient_profile
from app.services.patient_profile_change_service import (
    create_change_request,
    list_for_patient_and_doctor,
    serialize_change_request,
)
from app.services.presence_service import resolve_presence, touch_presence
from app.services.consultation_service import close_stale_consultations
from app.services.specialist_assistant import sanitize_summary_text
from app.services.reminder_service import reminder_service
from app.services.video_session_service import video_session_service
from app.services import session_file_service

router = APIRouter(prefix="/doctors", tags=["doctors"])
logger = get_logger(__name__)


def _get_approved_doctor_profile_or_403(db: Session, current_user: User) -> DoctorProfile:
    # La capacidad medica depende del perfil, no del rol principal del usuario.
    return get_doctor_profile_or_403(db, current_user, require_approved=True)


def _rating_aggregates(db: Session, doctor_ids: list[int]) -> dict[int, tuple[float, int]]:
    """Calcula el promedio y la cantidad real de resenas desde consultation_reviews."""
    if not doctor_ids:
        return {}
    rows = (
        db.query(
            ConsultationReview.doctor_id,
            func.avg(ConsultationReview.rating),
            func.count(ConsultationReview.id),
        )
        .filter(ConsultationReview.doctor_id.in_(doctor_ids))
        .group_by(ConsultationReview.doctor_id)
        .all()
    )
    return {
        doctor_id: (round(float(average or 0), 2), int(total or 0))
        for doctor_id, average, total in rows
    }


def _rating_for(db: Session, doctor_id: int) -> tuple[float, int]:
    return _rating_aggregates(db, [doctor_id]).get(doctor_id, (0.0, 0))


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
        .all()
    )

    # Expira sesiones vencidas y prepara el calculo de presencia real.
    video_session_service.expire_stale_sessions(db)
    active_doctor_ids: set[int] = set()
    if doctor_profiles:
        now = datetime.now(timezone.utc)
        rows = (
            db.query(VideoSession.doctor_id)
            .filter(
                VideoSession.doctor_id.in_([profile.id for profile in doctor_profiles]),
                VideoSession.status == VideoSessionStatus.active,
                VideoSession.expires_at > now,
            )
            .distinct()
            .all()
        )
        active_doctor_ids = {row[0] for row in rows}

    aggregates = _rating_aggregates(db, [profile.id for profile in doctor_profiles])
    doctor_profiles.sort(
        key=lambda profile: (
            -aggregates.get(profile.id, (0.0, 0))[0],
            -aggregates.get(profile.id, (0.0, 0))[1],
            profile.display_name.lower(),
        )
    )

    doctors = []
    for profile in doctor_profiles:
        rating_avg, rating_count = aggregates.get(profile.id, (0.0, 0))
        resolved = resolve_presence(db, profile, has_active_session=profile.id in active_doctor_ids)
        doctors.append(
            DoctorCardResponse(
                id=profile.id,
                user_id=profile.user_id,
                display_name=profile.display_name,
                professional_title=profile.professional_title,
                bio_short=profile.bio_short,
                price_per_min_cents=profile.price_per_min_cents,
                rating_avg=rating_avg,
                rating_count=rating_count,
                is_accepting_consultations=profile.is_accepting_consultations,
                status=profile.status,
                presence=DoctorPresenceResponse(
                    status=resolved.status,
                    status_message=resolved.status_message,
                    last_seen_at=resolved.last_seen_at,
                ),
            )
        )

    return DoctorListResponse(doctors=doctors, total=len(doctors))


@router.post("/presence/heartbeat", response_model=DoctorPresenceResponse)
def presence_heartbeat(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marca al medico como activo ahora (heartbeat del frontend)."""
    doctor_profile = get_doctor_profile_or_403(db, current_user)
    presence = touch_presence(db, doctor_profile)
    return DoctorPresenceResponse(
        status=presence.status,
        status_message=presence.status_message,
        last_seen_at=presence.last_seen_at,
    )


@router.post("/presence", response_model=DoctorPresenceResponse)
def update_my_presence(
    payload: DoctorPresenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor_profile = get_doctor_profile_or_403(db, current_user, require_approved=True)

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
    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not doctor_profile and current_user.role != UserRole.doctor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes un perfil medico")

    doctor_onboarding_service.validate_price_or_raise(payload.price_per_min_cents)

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
    rating_avg, rating_count = _rating_for(db, doctor_profile.id)
    return DoctorCardResponse(
        id=doctor_profile.id,
        user_id=doctor_profile.user_id,
        display_name=doctor_profile.display_name,
        professional_title=doctor_profile.professional_title,
        bio_short=doctor_profile.bio_short,
        price_per_min_cents=doctor_profile.price_per_min_cents,
        rating_avg=rating_avg,
        rating_count=rating_count,
        is_accepting_consultations=doctor_profile.is_accepting_consultations,
        status=doctor_profile.status,
        presence=DoctorPresenceResponse.model_validate(presence),
    )


@router.get("/me/application", response_model=DoctorApplicationResponse)
def get_my_doctor_application(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor_profile = get_doctor_profile_or_403(db, current_user)

    return doctor_onboarding_service.build_application_response_from_relations(doctor_profile)


@router.get("/applications", response_model=DoctorApplicationListResponse)
def list_doctor_applications(
    review_status: DoctorApprovalStatus | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_application_reviewer),
):
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
    current_user: User = Depends(require_application_reviewer),
):
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
    doctor_profile = get_doctor_profile_or_403(db, current_user)
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
    doctor_profile = get_doctor_profile_or_403(db, current_user)

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


def _get_live_video_sessions(db: Session, doctor_profile: DoctorProfile) -> list[VideoSession]:
    """Sesiones preparadas/activas que aun no expiran.

    Marca como expiradas las preparadas vencidas. Centraliza la regla para que el
    dashboard y la pagina de videoconsultas muestren exactamente lo mismo.
    """
    now = datetime.now(UTC)
    sessions = (
        db.query(VideoSession)
        .options(joinedload(VideoSession.patient).joinedload(User.patient_profile))
        .filter(
            VideoSession.doctor_id == doctor_profile.id,
            VideoSession.status.in_([VideoSessionStatus.prepared, VideoSessionStatus.active]),
        )
        .order_by(VideoSession.created_at.desc())
        .all()
    )

    live: list[VideoSession] = []
    changed = False
    for session in sessions:
        if session.expires_at <= now:
            if session.status == VideoSessionStatus.prepared:
                session.status = VideoSessionStatus.expired
                changed = True
            continue
        live.append(session)

    if changed:
        db.commit()
    return live


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
        .options(joinedload(Appointment.patient).joinedload(User.patient_profile))
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
        .options(joinedload(Appointment.patient).joinedload(User.patient_profile))
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
    average_rating = _rating_for(db, doctor_profile.id)[0]
    active_video_sessions = _get_live_video_sessions(db, doctor_profile)[:5]
    metrics = [
        DoctorDashboardMetricCard(key="scheduled", label="Citas programadas", value=str(total_scheduled)),
        DoctorDashboardMetricCard(key="completed", label="Citas completadas", value=str(total_completed)),
        DoctorDashboardMetricCard(key="rating", label="Valoración promedio", value=f"{average_rating:.1f}"),
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
                patient_name=get_patient_display_name(session.patient),
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
    # Cualquier usuario registrado puede ser paciente, no solo el rol "patient".
    patient = db.query(User).filter(User.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")

    if not _doctor_can_view_patient_history(db, doctor_profile.id, patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes ver el historial de pacientes con relacion clinica previa o cita agendada",
        )

    # Reflejar borradores inactivos como cerrados en el historial.
    close_stale_consultations(db, user_id=patient_id)

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
                summary=sanitize_summary_text(consultation.summary),
                intake=consultation.intake_json,
                created_at=consultation.created_at,
            )
        )

    appointment_items = []
    appointment_items_consultation_ids = {c.id for c in consultations}
    appointments = (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient_id, Appointment.doctor_id == doctor_profile.id)
        .order_by(Appointment.scheduled_at.desc())
        .all()
    )
    for appointment in appointments:
        review = appointment.review[0] if appointment.review else None
        # La preconsulta vinculada ya aparece como su propio evento: no repetimos
        # su resumen/ficha en la cita para no duplicar la informacion clinica.
        linked_consultation = (
            appointment.consultation_id is not None
            and appointment.consultation_id in appointment_items_consultation_ids
        )
        appointment_items.append(
            DoctorPatientTimelineItemResponse(
                item_type="appointment",
                sort_at=appointment.completed_at or appointment.scheduled_at,
                specialty_id=appointment.specialty_id,
                specialty_name=appointment.specialty.name if appointment.specialty else "Especialidad",
                consultation_id=appointment.consultation_id,
                appointment_id=appointment.id,
                appointment_status=appointment.status,
                summary=None if linked_consultation else sanitize_summary_text(appointment.ai_summary_snapshot),
                intake=None if linked_consultation else appointment.ai_intake_snapshot_json,
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

    video_items = []
    standalone_sessions = (
        db.query(VideoSession)
        .filter(
            VideoSession.doctor_id == doctor_profile.id,
            VideoSession.patient_id == patient_id,
            VideoSession.appointment_id.is_(None),
            VideoSession.status.in_([VideoSessionStatus.active, VideoSessionStatus.completed]),
        )
        .all()
    )
    for session in standalone_sessions:
        specialty = session.consultation.specialty if session.consultation else None
        video_items.append(
            DoctorPatientTimelineItemResponse(
                item_type="video_session",
                sort_at=session.ended_at or session.started_at or session.created_at,
                specialty_id=session.consultation.specialty_id if session.consultation else 0,
                specialty_name=specialty.name if specialty else "Videoconsulta",
                consultation_id=session.consultation_id,
                video_session_id=session.id,
                video_session_status=session.status.value,
                created_at=session.created_at,
            )
        )

    items = sorted([*appointment_items, *consultation_items, *video_items], key=lambda item: item.sort_at, reverse=True)

    appointment_ids = [item.appointment_id for item in appointment_items if item.appointment_id]
    session_ids = [item.video_session_id for item in video_items if item.video_session_id]
    files_by_appointment = session_file_service.list_files_grouped_by_appointment(db, appointment_ids)
    files_by_session = session_file_service.list_files_grouped_by_session(db, session_ids)
    for item in appointment_items:
        if item.appointment_id:
            item.files = files_by_appointment.get(item.appointment_id, [])
    for item in video_items:
        if item.video_session_id:
            item.files = files_by_session.get(item.video_session_id, [])

    return DoctorPatientTimelineResponse(
        patient_id=patient.id,
        patient_email=patient.email,
        doctor_id=doctor_profile.id,
        can_view_history=True,
        items=items,
        total=len(items),
        files_enabled=settings.cloudinary_enabled,
    )


@router.get("/me/patients", response_model=DoctorPatientListResponse)
def list_my_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pacientes con los que el medico ha trabajado (citas y/o videoconsultas)."""
    doctor_profile = _get_approved_doctor_profile_or_403(db, current_user)
    now = datetime.now(timezone.utc)

    appointments = (
        db.query(Appointment)
        .options(joinedload(Appointment.patient).joinedload(User.patient_profile))
        .filter(Appointment.doctor_id == doctor_profile.id)
        .all()
    )
    video_sessions = (
        db.query(VideoSession)
        .options(joinedload(VideoSession.patient).joinedload(User.patient_profile))
        .filter(VideoSession.doctor_id == doctor_profile.id)
        .all()
    )

    entries: dict[int, dict] = {}

    def _entry(patient: User | None, patient_id: int) -> dict:
        if patient_id not in entries:
            entries[patient_id] = {
                "patient": patient,
                "appointments_count": 0,
                "completed_appointments": 0,
                "upcoming_appointments": 0,
                "video_sessions_count": 0,
                "last_activity_at": None,
                "last_review_rating": None,
            }
        elif patient is not None and entries[patient_id]["patient"] is None:
            entries[patient_id]["patient"] = patient
        return entries[patient_id]

    def _touch(entry: dict, moment: datetime | None) -> None:
        if moment is None:
            return
        current = entry["last_activity_at"]
        if current is None or moment > current:
            entry["last_activity_at"] = moment

    for appointment in appointments:
        entry = _entry(appointment.patient, appointment.patient_id)
        entry["appointments_count"] += 1
        if appointment.status == AppointmentStatus.completed:
            entry["completed_appointments"] += 1
        if appointment.status == AppointmentStatus.scheduled and appointment.scheduled_at >= now:
            entry["upcoming_appointments"] += 1
        _touch(entry, appointment.completed_at or appointment.scheduled_at or appointment.created_at)
        review = appointment.review[0] if appointment.review else None
        if review and entry["last_review_rating"] is None:
            entry["last_review_rating"] = review.rating

    for session in video_sessions:
        # Solo cuentan las sesiones que realmente ocurrieron (no salas abandonadas/expiradas).
        if session.status not in {VideoSessionStatus.active, VideoSessionStatus.completed}:
            continue
        entry = _entry(session.patient, session.patient_id)
        entry["video_sessions_count"] += 1
        _touch(entry, session.ended_at or session.started_at or session.created_at)

    patients = [
        DoctorPatientSummary(
            patient_id=patient_id,
            email=entry["patient"].email if entry["patient"] else "",
            full_name=get_patient_display_name(entry["patient"]),
            appointments_count=entry["appointments_count"],
            completed_appointments=entry["completed_appointments"],
            upcoming_appointments=entry["upcoming_appointments"],
            video_sessions_count=entry["video_sessions_count"],
            last_activity_at=entry["last_activity_at"],
            last_review_rating=entry["last_review_rating"],
        )
        for patient_id, entry in entries.items()
    ]
    patients.sort(
        key=lambda item: (item.last_activity_at or datetime.min.replace(tzinfo=timezone.utc)),
        reverse=True,
    )
    return DoctorPatientListResponse(patients=patients, total=len(patients))


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


@router.get("/patients/{patient_id}/profile", response_model=PatientProfileResponse)
def get_patient_profile_for_doctor(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Perfil del paciente para el medico, si existe relacion clinica."""
    doctor_profile = _get_approved_doctor_profile_or_403(db, current_user)
    if not _doctor_can_view_patient_history(db, doctor_profile.id, patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes ver pacientes con relacion clinica previa o cita agendada",
        )

    patient = db.query(User).filter(User.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")

    profile = db.query(PatientProfile).filter(PatientProfile.user_id == patient_id).first()
    return serialize_patient_profile(profile, patient)


@router.get(
    "/patients/{patient_id}/profile-change-requests",
    response_model=list[PatientProfileChangeRequestResponse],
)
def list_patient_profile_change_requests(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Propuestas de cambio de datos que este médico envió al paciente."""
    doctor_profile = _get_approved_doctor_profile_or_403(db, current_user)
    if not _doctor_can_view_patient_history(db, doctor_profile.id, patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes ver pacientes con relacion clinica previa o cita agendada",
        )

    requests = list_for_patient_and_doctor(
        db, patient_id=patient_id, doctor_profile_id=doctor_profile.id
    )
    return [serialize_change_request(db, request) for request in requests]


@router.post(
    "/patients/{patient_id}/profile-change-requests",
    response_model=PatientProfileChangeRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_patient_profile_change_request(
    patient_id: int,
    payload: PatientProfileChangeRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Propone cambios en los datos del paciente. El paciente debe aprobarlos."""
    doctor_profile = _get_approved_doctor_profile_or_403(db, current_user)
    if not _doctor_can_view_patient_history(db, doctor_profile.id, patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes ver pacientes con relacion clinica previa o cita agendada",
        )

    patient = db.query(User).filter(User.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")

    try:
        request = create_change_request(
            db,
            patient=patient,
            doctor_profile=doctor_profile,
            payload=payload,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    notification_service.create(
        db,
        user_id=patient.id,
        notification_type="patient_profile_change_request",
        title="Tu medico propone actualizar tus datos",
        body=(
            f"El Dr(a). {doctor_profile.display_name} propuso cambios en tu perfil clinico. "
            "Revisalos y acepta o rechaza los cambios."
        ),
        action_url="/me/profile",
        metadata={
            "action_label": "Revisar cambios",
            "change_request_id": request.id,
            "doctor_id": doctor_profile.id,
        },
    )
    db.commit()
    db.refresh(request)
    return serialize_change_request(db, request)


@router.get("/me/video-sessions", response_model=DoctorVideoSessionListResponse)
def get_my_video_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor_profile = _get_approved_doctor_profile_or_403(db, current_user)

    sessions = _get_live_video_sessions(db, doctor_profile)

    result = []
    for session in sessions:
        try:
            doctor_token = jitsi_service.create_meeting_token(
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
                patient_name=get_patient_display_name(session.patient),
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


@router.get("/me/reviews", response_model=DoctorReviewsResponse)
def get_my_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reseñas reales del medico autenticado."""
    doctor_profile = _get_approved_doctor_profile_or_403(db, current_user)
    reviews = (
        db.query(ConsultationReview)
        .filter(ConsultationReview.doctor_id == doctor_profile.id)
        .order_by(ConsultationReview.created_at.desc())
        .all()
    )
    rating_avg, rating_count = _rating_for(db, doctor_profile.id)
    return DoctorReviewsResponse(
        reviews=[
            DoctorReviewResponse(
                id=review.id,
                rating=review.rating,
                comment=review.comment,
                patient_label="Paciente verificado",
                created_at=review.created_at,
            )
            for review in reviews
        ],
        total=len(reviews),
        rating_avg=rating_avg,
        rating_count=rating_count,
    )


@router.get("/{doctor_id}", response_model=DoctorDetailResponse)
def get_doctor_detail(doctor_id: int, db: Session = Depends(get_db)):
    """Perfil publico de un medico aprobado con sus especialidades y resenas."""
    doctor_profile = (
        db.query(DoctorProfile)
        .filter(DoctorProfile.id == doctor_id, DoctorProfile.status == DoctorApprovalStatus.approved)
        .first()
    )
    if not doctor_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medico no encontrado")

    video_session_service.expire_stale_sessions(db, doctor_id=doctor_id)
    resolved = resolve_presence(db, doctor_profile)
    presence = DoctorPresenceResponse(
        status=resolved.status,
        status_message=resolved.status_message,
        last_seen_at=resolved.last_seen_at,
    )

    specialties = sorted(
        (link.specialty for link in doctor_profile.doctor_specialties if link.specialty),
        key=lambda specialty: specialty.name.lower(),
    )

    reviews = (
        db.query(ConsultationReview)
        .filter(ConsultationReview.doctor_id == doctor_id)
        .order_by(ConsultationReview.created_at.desc())
        .limit(30)
        .all()
    )

    rating_avg, rating_count = _rating_for(db, doctor_id)
    return DoctorDetailResponse(
        id=doctor_profile.id,
        user_id=doctor_profile.user_id,
        display_name=doctor_profile.display_name,
        professional_title=doctor_profile.professional_title,
        bio_short=doctor_profile.bio_short,
        price_per_min_cents=doctor_profile.price_per_min_cents,
        rating_avg=rating_avg,
        rating_count=rating_count,
        is_accepting_consultations=doctor_profile.is_accepting_consultations,
        status=doctor_profile.status,
        presence=presence,
        years_experience=doctor_profile.years_experience,
        city=doctor_profile.city,
        country=doctor_profile.country,
        specialties=[
            DoctorSpecialtySummary(id=specialty.id, slug=specialty.slug, name=specialty.name)
            for specialty in specialties
        ],
        reviews=[
            DoctorReviewResponse(
                id=review.id,
                rating=review.rating,
                comment=review.comment,
                patient_label="Paciente verificado",
                created_at=review.created_at,
            )
            for review in reviews
        ],
    )
