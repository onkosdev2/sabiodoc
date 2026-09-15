from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_admin
from app.core.security import get_password_hash
from app.models.appointment import Appointment, AppointmentStatus
from app.models.audit_log import AuditLog
from app.models.consultation import Consultation
from app.models.consultation_review import ConsultationReview
from app.models.doctor_availability_slot import DoctorAvailabilitySlot
from app.models.doctor_presence import DoctorPresence, DoctorPresenceStatus
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.doctor_specialty import DoctorSpecialty
from app.models.favorite import Favorite
from app.models.notification import Notification, NotificationStatus
from app.models.triage_request import TriageRequest
from app.models.user import User, UserRole
from app.models.video_session import VideoSession, VideoSessionStatus
from app.schemas.appointment import (
    AdminIncidentListResponse,
    AdminIncidentResponse,
    AdminLiveVideoSessionListResponse,
    AdminLiveVideoSessionResponse,
    AdminMarketplaceOverviewResponse,
)
from app.schemas.user import (
    AdminUserCreate,
    AdminUserListResponse,
    AdminUserResponse,
    AdminUserUpdate,
    ReviewerCreate,
    ReviewerListResponse,
    ReviewerResponse,
)
from app.services.audit_service import audit_service

router = APIRouter(prefix="/admin", tags=["admin"])


def _serialize_admin_user(user: User) -> AdminUserResponse:
    profile = getattr(user, "doctor_profile", None)
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        doctor_status=profile.status if profile else None,
        created_at=user.created_at,
    )


def _count_admins(db: Session) -> int:
    return db.query(User).filter(User.role == UserRole.admin).count()


@router.get("/marketplace/overview", response_model=AdminMarketplaceOverviewResponse)
def get_marketplace_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")

    doctors_online = db.query(DoctorPresence).filter(DoctorPresence.status == DoctorPresenceStatus.online).count()
    doctors_busy = db.query(DoctorPresence).filter(DoctorPresence.status == DoctorPresenceStatus.busy).count()
    pending_applications = db.query(DoctorProfile).filter(DoctorProfile.status == DoctorApprovalStatus.pending).count()
    scheduled_appointments = db.query(Appointment).filter(Appointment.status == AppointmentStatus.scheduled).count()
    completed_appointments = db.query(Appointment).filter(Appointment.status == AppointmentStatus.completed).count()
    active_video_sessions = db.query(VideoSession).filter(VideoSession.status == VideoSessionStatus.active).count()
    failed_video_sessions = db.query(VideoSession).filter(VideoSession.status.in_([VideoSessionStatus.failed, VideoSessionStatus.expired])).count()
    no_show_appointments = db.query(Appointment).filter(Appointment.status == AppointmentStatus.no_show).count()
    unread_notifications = db.query(Notification).filter(Notification.status == NotificationStatus.unread).count()

    return AdminMarketplaceOverviewResponse(
        doctors_online=doctors_online,
        doctors_busy=doctors_busy,
        pending_applications=pending_applications,
        scheduled_appointments=scheduled_appointments,
        completed_appointments=completed_appointments,
        active_video_sessions=active_video_sessions,
        failed_video_sessions=failed_video_sessions,
        no_show_appointments=no_show_appointments,
        unread_notifications=unread_notifications,
    )


@router.get("/video-sessions/live", response_model=AdminLiveVideoSessionListResponse)
def get_live_video_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")

    sessions = (
        db.query(VideoSession)
        .filter(VideoSession.status.in_([VideoSessionStatus.prepared, VideoSessionStatus.active]))
        .order_by(VideoSession.created_at.desc())
        .limit(20)
        .all()
    )
    return AdminLiveVideoSessionListResponse(
        sessions=[
            AdminLiveVideoSessionResponse(
                video_session_id=session.id,
                appointment_id=session.appointment_id,
                consultation_id=session.consultation_id,
                doctor_name=session.doctor.display_name if session.doctor else "Medico",
                patient_email=session.patient.email if session.patient else "",
                status=session.status.value,
                started_at=session.started_at,
                expires_at=session.expires_at,
                joined_patient_at=session.joined_patient_at,
                joined_doctor_at=session.joined_doctor_at,
            )
            for session in sessions
        ],
        total=len(sessions),
    )


@router.get("/incidents", response_model=AdminIncidentListResponse)
def get_admin_incidents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")

    incidents: list[AdminIncidentResponse] = []

    failed_sessions = (
        db.query(VideoSession)
        .filter(VideoSession.status.in_([VideoSessionStatus.failed, VideoSessionStatus.expired]))
        .order_by(VideoSession.updated_at.desc())
        .limit(10)
        .all()
    )
    for session in failed_sessions:
        incidents.append(
            AdminIncidentResponse(
                type="video_session",
                title=f"Videoconsulta {session.status.value}: {session.doctor.display_name if session.doctor else 'Medico'}",
                created_at=session.updated_at or session.created_at,
                action_url="/admin/doctor-applications",
                entity_id=session.id,
            )
        )

    no_shows = (
        db.query(Appointment)
        .filter(Appointment.status == AppointmentStatus.no_show)
        .order_by(Appointment.no_show_marked_at.desc())
        .limit(10)
        .all()
    )
    for appointment in no_shows:
        incidents.append(
            AdminIncidentResponse(
                type="appointment_no_show",
                title=f"No-show en {appointment.specialty.name if appointment.specialty else 'consulta'} con {appointment.doctor.display_name if appointment.doctor else 'medico'}",
                created_at=appointment.no_show_marked_at or appointment.updated_at or appointment.created_at,
                action_url="/admin/doctor-applications",
                entity_id=appointment.id,
            )
        )

    recent_audits = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(10).all()
    for audit in recent_audits:
        incidents.append(
            AdminIncidentResponse(
                type="audit",
                title=f"{audit.action} ({audit.entity_type})",
                created_at=audit.created_at,
                action_url="/admin/doctor-applications",
                entity_id=audit.entity_id,
            )
        )

    incidents.sort(key=lambda item: item.created_at, reverse=True)
    incidents = incidents[:15]
    return AdminIncidentListResponse(incidents=incidents, total=len(incidents))


@router.get("/reviewers", response_model=ReviewerListResponse)
def list_reviewers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    reviewers = (
        db.query(User)
        .filter(User.role == UserRole.reviewer)
        .order_by(User.created_at.desc())
        .all()
    )
    return ReviewerListResponse(
        reviewers=[ReviewerResponse.model_validate(reviewer) for reviewer in reviewers],
        total=len(reviewers),
    )


@router.post("/reviewers", response_model=ReviewerResponse, status_code=status.HTTP_201_CREATED)
def create_reviewer(
    payload: ReviewerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        if existing.role == UserRole.reviewer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este usuario ya es revisor",
            )
        # Promovemos una cuenta existente (paciente o medico) a revisor sin
        # perder sus capacidades previas: un medico conserva su DoctorProfile.
        existing.role = UserRole.reviewer
        reviewer = existing
        action = "reviewer.promoted"
    else:
        if not payload.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña es obligatoria para crear un revisor",
            )
        reviewer = User(
            email=payload.email,
            password_hash=get_password_hash(payload.password),
            role=UserRole.reviewer,
        )
        db.add(reviewer)
        action = "reviewer.created"

    db.flush()
    audit_service.log(
        db,
        action=action,
        entity_type="user",
        entity_id=reviewer.id,
        actor_user_id=current_user.id,
        metadata={"email": reviewer.email},
    )
    db.commit()
    db.refresh(reviewer)
    return ReviewerResponse.model_validate(reviewer)


@router.delete("/reviewers/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_reviewer(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    reviewer = (
        db.query(User)
        .filter(User.id == user_id, User.role == UserRole.reviewer)
        .first()
    )
    if not reviewer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Revisor no encontrado",
        )

    reviewer.role = UserRole.patient
    doctor_profile = (
        db.query(DoctorProfile)
        .filter(DoctorProfile.user_id == reviewer.id)
        .first()
    )
    restored_role = "patient"
    if doctor_profile and doctor_profile.status == DoctorApprovalStatus.approved:
        # Si tambien era medico, le devolvemos su rol medico para que conserve
        # el acceso al panel medico despues de revocar el acceso de revision.
        reviewer.role = UserRole.doctor
        restored_role = "doctor"
    audit_service.log(
        db,
        action="reviewer.revoked",
        entity_type="user",
        entity_id=reviewer.id,
        actor_user_id=current_user.id,
        metadata={"email": reviewer.email, "restored_role": restored_role},
    )
    db.commit()
    return None


@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    role: UserRole | None = None,
    search: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if search:
        query = query.filter(User.email.ilike(f"%{search}%"))

    total = query.count()
    users = (
        query.order_by(User.created_at.desc(), User.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return AdminUserListResponse(
        users=[_serialize_admin_user(user) for user in users],
        total=total,
    )


@router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado",
        )

    # Un medico requiere un DoctorProfile (flujo de postulación). Se puede crear
    # la cuenta y luego promoverla cuando el perfil exista.
    if payload.role == UserRole.doctor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Para crear un médico usa el flujo de postulación; luego podrás asignarle el rol",
        )

    user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.flush()
    audit_service.log(
        db,
        action="user.created",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=current_user.id,
        metadata={"email": user.email, "role": user.role.value},
    )
    db.commit()
    db.refresh(user)
    return _serialize_admin_user(user)


@router.get("/users/{user_id}", response_model=AdminUserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return _serialize_admin_user(user)


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    if payload.email and payload.email != user.email:
        existing = (
            db.query(User)
            .filter(User.email == payload.email, User.id != user.id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El email ya está registrado por otro usuario",
            )
        user.email = payload.email

    if payload.password:
        user.password_hash = get_password_hash(payload.password)

    if payload.role and payload.role != user.role:
        if user.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes cambiar tu propio rol",
            )
        if user.role == UserRole.admin and _count_admins(db) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe existir al menos un administrador",
            )
        if payload.role == UserRole.doctor:
            profile = (
                db.query(DoctorProfile)
                .filter(DoctorProfile.user_id == user.id)
                .first()
            )
            if not profile:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El usuario necesita un perfil médico para tener el rol de médico",
                )
        user.role = payload.role

    audit_service.log(
        db,
        action="user.updated",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=current_user.id,
        metadata={"email": user.email, "role": user.role.value},
    )
    db.commit()
    db.refresh(user)
    return _serialize_admin_user(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminar tu propia cuenta",
        )
    if user.role == UserRole.admin and _count_admins(db) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe existir al menos un administrador",
        )

    profile = (
        db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    )

    # Protegemos el historial clinico: no se elimina un usuario con actividad real.
    has_history = (
        db.query(Appointment.id).filter(Appointment.patient_id == user.id).first()
        or db.query(Consultation.id).filter(Consultation.user_id == user.id).first()
        or db.query(ConsultationReview.id).filter(ConsultationReview.patient_id == user.id).first()
        or db.query(VideoSession.id).filter(VideoSession.patient_id == user.id).first()
    )
    if not has_history and profile:
        has_history = (
            db.query(Appointment.id).filter(Appointment.doctor_id == profile.id).first()
            or db.query(VideoSession.id).filter(VideoSession.doctor_id == profile.id).first()
        )
    if has_history:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El usuario tiene historial clínico y no puede eliminarse. Suspende o desactiva su acceso en su lugar.",
        )

    db.query(Favorite).filter(Favorite.user_id == user.id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.user_id == user.id).delete(synchronize_session=False)
    db.query(TriageRequest).filter(TriageRequest.user_id == user.id).delete(synchronize_session=False)
    if profile:
        db.query(DoctorSpecialty).filter(DoctorSpecialty.doctor_id == profile.id).delete(synchronize_session=False)
        db.query(DoctorAvailabilitySlot).filter(DoctorAvailabilitySlot.doctor_id == profile.id).delete(synchronize_session=False)
        db.query(DoctorPresence).filter(DoctorPresence.doctor_id == profile.id).delete(synchronize_session=False)
        db.query(DoctorProfile).filter(DoctorProfile.id == profile.id).delete(synchronize_session=False)

    # Preservamos la bitacora: los registros de auditoria quedan sin actor.
    db.query(AuditLog).filter(AuditLog.actor_user_id == user.id).update(
        {AuditLog.actor_user_id: None}, synchronize_session=False
    )
    db.query(VideoSession).filter(VideoSession.ended_by_user_id == user.id).update(
        {VideoSession.ended_by_user_id: None}, synchronize_session=False
    )

    audit_service.log(
        db,
        action="user.deleted",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=current_user.id,
        metadata={"email": user.email, "role": user.role.value},
    )
    db.delete(user)
    db.commit()
    return None
