import json
import re
import unicodedata
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.deps import get_current_user, get_db, require_admin, require_admin_or_support
from app.core.labels import (
    audit_action_label,
    audit_entity_label,
    video_session_status_label,
)
from app.core.security import get_password_hash
from app.models.appointment import Appointment, AppointmentStatus
from app.models.audit_log import AuditLog
from app.models.consultation import Consultation
from app.models.consultation_review import ConsultationReview
from app.models.doctor_availability_slot import DoctorAvailabilitySlot
from app.models.doctor_presence import DoctorPresence
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.doctor_specialty import DoctorSpecialty
from app.models.email_verification_token import EmailVerificationToken
from app.models.error_log import ErrorLog
from app.models.password_reset_token import PasswordResetToken
from app.models.patient_profile import PatientProfile
from app.models.patient_profile_change_request import PatientProfileChangeRequest
from app.models.specialty import Specialty
from app.models.favorite import Favorite
from app.models.notification import Notification, NotificationStatus
from app.models.review_report import ReviewReport, ReviewReportStatus
from app.models.triage_request import TriageRequest
from app.models.user import User, UserRole, UserRoleAssignment, sorted_roles
from app.models.video_session import VideoSession, VideoSessionStatus
from app.models.video_session_file import VideoSessionFile
from app.models.wallet import Wallet, WalletTransaction, Withdrawal, WithdrawalStatus
from app.schemas.appointment import (
    AdminIncidentListResponse,
    AdminIncidentResponse,
    AdminLiveVideoSessionListResponse,
    AdminLiveVideoSessionResponse,
    AdminMarketplaceOverviewResponse,
    AppointmentListResponse,
)
from app.schemas.error_log import (
    ErrorLogBulkDeleteRequest,
    ErrorLogCleanupResponse,
    ErrorLogDeleteResponse,
    ErrorLogDetail,
    ErrorLogItem,
    ErrorLogListResponse,
    ErrorLogSummary,
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
from app.schemas.doctor import (
    AdminReviewItem,
    AdminReviewListResponse,
    AdminReviewReportItem,
    AdminReviewReportListResponse,
    ReviewModerationRequest,
    ReviewReportStatusUpdate,
)
from app.services.appointment_service import appointment_service
from app.services.audit_service import audit_service
from app.services.error_log_service import error_log_service
from app.services.user_support_service import user_support_service
from app.services.patient_profile_service import get_patient_display_name
from app.services.llm_client import llm_client
from app.services import review_service
from app.services.wallet_service import wallet_service
from app.schemas.support import SupportUserDetailResponse
from app.schemas.wallet import (
    WithdrawalListResponse,
    WithdrawalResponse,
)
from app.schemas.specialty import (
    SpecialtyCreate,
    SpecialtyListResponse,
    SpecialtyResponse,
    SpecialtyUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/ai/status")
def get_ai_status(current_user: User = Depends(require_admin)):
    """Estado de los proveedores de IA (solo admin).

    Vive bajo `/admin` a propósito: algunos bloqueadores (uBlock) filtran rutas
    que empiezan por `/health` en dominios como `onrender.com`, y la petición
    nunca llegaría al backend. No usamos `/health` para nada que consuma el
    navegador.
    """
    return llm_client.health_check()


def _serialize_admin_user(user: User) -> AdminUserResponse:
    profile = getattr(user, "doctor_profile", None)
    full_name = profile.display_name if profile and profile.display_name else get_patient_display_name(user)
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        full_name=full_name,
        role=user.primary_role,
        roles=sorted_roles(user.roles),
        doctor_status=profile.status if profile else None,
        created_at=user.created_at,
    )


def _serialize_reviewer(user: User) -> ReviewerResponse:
    return ReviewerResponse(
        id=user.id,
        email=user.email,
        role=user.primary_role,
        roles=sorted_roles(user.roles),
        created_at=user.created_at,
    )


def _count_admins(db: Session) -> int:
    return (
        db.query(UserRoleAssignment)
        .filter(UserRoleAssignment.role == UserRole.admin)
        .count()
    )


def _slugify(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    return slug or "especialidad"


@router.get("/specialties", response_model=SpecialtyListResponse)
def list_admin_specialties(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    specialties = db.query(Specialty).order_by(Specialty.name).all()
    return SpecialtyListResponse(
        specialties=[SpecialtyResponse.model_validate(item) for item in specialties],
        total=len(specialties),
    )


@router.post("/specialties", response_model=SpecialtyResponse, status_code=status.HTTP_201_CREATED)
def create_admin_specialty(
    payload: SpecialtyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    slug = (payload.slug or _slugify(payload.name)).strip().lower()
    if db.query(Specialty).filter(Specialty.slug == slug).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una especialidad con ese slug",
        )

    specialty = Specialty(
        slug=slug,
        name=payload.name.strip(),
        description=payload.description,
        keywords=payload.keywords or [],
        is_top=payload.is_top,
    )
    db.add(specialty)
    db.flush()
    audit_service.log(
        db,
        action="specialty.created",
        entity_type="specialty",
        entity_id=specialty.id,
        actor_user_id=current_user.id,
        metadata={"slug": slug},
    )
    db.commit()
    db.refresh(specialty)
    return SpecialtyResponse.model_validate(specialty)


@router.patch("/specialties/{specialty_id}", response_model=SpecialtyResponse)
def update_admin_specialty(
    specialty_id: int,
    payload: SpecialtyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    specialty = db.query(Specialty).filter(Specialty.id == specialty_id).first()
    if not specialty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Especialidad no encontrada"
        )

    data = payload.model_dump(exclude_unset=True)
    if data.get("slug"):
        new_slug = data["slug"].strip().lower()
        if (
            new_slug != specialty.slug
            and db.query(Specialty).filter(Specialty.slug == new_slug).first()
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe una especialidad con ese slug",
            )
        specialty.slug = new_slug
    if data.get("name"):
        specialty.name = data["name"].strip()
    if "description" in data:
        specialty.description = data["description"]
    if "keywords" in data:
        specialty.keywords = data["keywords"] or []
    if "is_top" in data and data["is_top"] is not None:
        specialty.is_top = data["is_top"]

    audit_service.log(
        db,
        action="specialty.updated",
        entity_type="specialty",
        entity_id=specialty.id,
        actor_user_id=current_user.id,
        metadata={"slug": specialty.slug},
    )
    db.commit()
    db.refresh(specialty)
    return SpecialtyResponse.model_validate(specialty)


@router.delete("/specialties/{specialty_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_specialty(
    specialty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    specialty = db.query(Specialty).filter(Specialty.id == specialty_id).first()
    if not specialty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Especialidad no encontrada"
        )

    referenced = (
        db.query(Appointment.id).filter(Appointment.specialty_id == specialty_id).first()
        or db.query(Consultation.id).filter(Consultation.specialty_id == specialty_id).first()
        or db.query(DoctorSpecialty.id)
        .filter(DoctorSpecialty.specialty_id == specialty_id)
        .first()
    )
    if referenced:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No se puede eliminar: la especialidad tiene citas, consultas o "
                "médicos asociados."
            ),
        )

    audit_service.log(
        db,
        action="specialty.deleted",
        entity_type="specialty",
        entity_id=specialty.id,
        actor_user_id=current_user.id,
        metadata={"slug": specialty.slug},
    )
    db.delete(specialty)
    db.commit()


@router.get("/marketplace/overview", response_model=AdminMarketplaceOverviewResponse)
def get_marketplace_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")

    now = datetime.now(UTC)
    online_threshold = now - timedelta(minutes=settings.DOCTOR_PRESENCE_ONLINE_MINUTES)
    doctors_online = (
        db.query(DoctorPresence).filter(DoctorPresence.last_seen_at >= online_threshold).count()
    )
    doctors_busy = (
        db.query(VideoSession.doctor_id)
        .filter(
            VideoSession.status == VideoSessionStatus.active,
            VideoSession.expires_at > now,
        )
        .distinct()
        .count()
    )
    pending_applications = db.query(DoctorProfile).filter(DoctorProfile.status == DoctorApprovalStatus.pending).count()
    scheduled_appointments = db.query(Appointment).filter(Appointment.status == AppointmentStatus.scheduled).count()
    completed_appointments = db.query(Appointment).filter(Appointment.status == AppointmentStatus.completed).count()
    active_video_sessions = (
        db.query(VideoSession)
        .filter(
            VideoSession.status == VideoSessionStatus.active,
            VideoSession.expires_at > now,
        )
        .count()
    )
    failed_video_sessions = db.query(VideoSession).filter(VideoSession.status.in_([VideoSessionStatus.failed, VideoSessionStatus.expired])).count()
    no_show_appointments = db.query(Appointment).filter(Appointment.status == AppointmentStatus.no_show).count()
    unread_notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.status == NotificationStatus.unread,
        )
        .count()
    )

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


@router.get("/appointments", response_model=AppointmentListResponse)
def list_appointments(
    status_filter: AppointmentStatus | None = None,
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Citas de todos los médicos, con filtro opcional por estado."""
    query = db.query(Appointment).options(joinedload(Appointment.patient).joinedload(User.patient_profile))
    if status_filter:
        query = query.filter(Appointment.status == status_filter)
    appointments = query.order_by(Appointment.scheduled_at.desc()).limit(limit).all()
    return AppointmentListResponse(
        appointments=[appointment_service.serialize_appointment(item) for item in appointments],
        total=len(appointments),
    )


@router.get("/video-sessions/live", response_model=AdminLiveVideoSessionListResponse)
def get_live_video_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")

    sessions = (
        db.query(VideoSession)
        .options(joinedload(VideoSession.patient).joinedload(User.patient_profile))
        .filter(
            VideoSession.status.in_([VideoSessionStatus.prepared, VideoSessionStatus.active]),
            VideoSession.expires_at > datetime.now(UTC),
        )
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
                doctor_name=session.doctor.display_name if session.doctor else "Médico",
                patient_email=session.patient.email if session.patient else "",
                patient_name=get_patient_display_name(session.patient),
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
    if not current_user.is_admin:
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
                title=(
                    "Videoconsulta "
                    f"{video_session_status_label(session.status).lower()}: "
                    f"{session.doctor.display_name if session.doctor else 'Médico'}"
                ),
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
                title=f"Inasistencia en {appointment.specialty.name if appointment.specialty else 'consulta'} con {appointment.doctor.display_name if appointment.doctor else 'médico'}",
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
                title=f"{audit_action_label(audit.action)} ({audit_entity_label(audit.entity_type)})",
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
        .join(UserRoleAssignment, UserRoleAssignment.user_id == User.id)
        .filter(UserRoleAssignment.role == UserRole.reviewer)
        .order_by(User.created_at.desc())
        .all()
    )
    return ReviewerListResponse(
        reviewers=[_serialize_reviewer(reviewer) for reviewer in reviewers],
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
        if existing.is_reviewer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este usuario ya es revisor",
            )
        # Se suma el rol de revisor sin quitar los demás (paciente, médico, admin).
        existing.add_role(UserRole.reviewer)
        reviewer = existing
        action = "reviewer.granted"
    else:
        if not payload.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña es obligatoria para crear un revisor",
            )
        reviewer = User(
            email=payload.email,
            password_hash=get_password_hash(payload.password),
        )
        reviewer.set_roles({UserRole.patient, UserRole.reviewer})
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
    return _serialize_reviewer(reviewer)


@router.delete("/reviewers/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_reviewer(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    reviewer = (
        db.query(User)
        .join(UserRoleAssignment, UserRoleAssignment.user_id == User.id)
        .filter(
            User.id == user_id,
            UserRoleAssignment.role == UserRole.reviewer,
        )
        .first()
    )
    if not reviewer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Revisor no encontrado",
        )

    reviewer.remove_role(UserRole.reviewer)
    audit_service.log(
        db,
        action="reviewer.revoked",
        entity_type="user",
        entity_id=reviewer.id,
        actor_user_id=current_user.id,
        metadata={"email": reviewer.email},
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
    current_user: User = Depends(require_admin_or_support),
):
    query = db.query(User)
    if role:
        query = query.join(
            UserRoleAssignment, UserRoleAssignment.user_id == User.id
        ).filter(UserRoleAssignment.role == role)
        # El rol "paciente" lo tiene toda cuenta (rol base); como filtro util se
        # interpreta como "solo paciente" (sin rol profesional).
        if role == UserRole.patient:
            query = query.filter(
                ~User.role_assignments.any(
                    UserRoleAssignment.role.in_(
                        (UserRole.doctor, UserRole.reviewer, UserRole.admin)
                    )
                )
            )
    if search:
        query = query.filter(User.email.ilike(f"%{search}%"))

    total = query.count()
    users = (
        query.options(joinedload(User.patient_profile), joinedload(User.doctor_profile))
        .order_by(User.created_at.desc(), User.id.desc())
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
            detail="El correo ya está registrado",
        )

    # Un médico requiere un DoctorProfile (flujo de postulación). Se puede crear
    # la cuenta y luego promoverla cuando el perfil exista.
    if UserRole.doctor in set(payload.roles):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Para crear un médico usa el flujo de postulación; luego podrás asignarle el rol",
        )

    user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
    )
    user.set_roles(payload.roles)
    db.add(user)
    db.flush()
    audit_service.log(
        db,
        action="user.created",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=current_user.id,
        metadata={"email": user.email, "roles": [role.value for role in sorted_roles(user.roles)]},
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


@router.get("/users/{user_id}/support", response_model=SupportUserDetailResponse)
def get_user_support(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_support),
):
    """Vista de soporte 360°: citas, videoconsultas, monedero, errores, etc."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user_support_service.build(db, user)


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
                detail="El correo ya está registrado por otro usuario",
            )
        user.email = payload.email

    if payload.password:
        user.password_hash = get_password_hash(payload.password)
        # Invalida las sesiones activas del usuario.
        user.session_version = (user.session_version or 1) + 1

    if payload.roles is not None:
        new_roles = set(payload.roles)
        if new_roles != user.roles:
            if user.id == current_user.id and UserRole.admin not in new_roles:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No puedes quitarte tu propio rol de administrador",
                )
            if (
                UserRole.admin in user.roles
                and UserRole.admin not in new_roles
                and _count_admins(db) <= 1
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Debe existir al menos un administrador",
                )
            if UserRole.doctor in new_roles and UserRole.doctor not in user.roles:
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
            user.set_roles(new_roles)

    audit_service.log(
        db,
        action="user.updated",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=current_user.id,
        metadata={"email": user.email, "roles": [role.value for role in sorted_roles(user.roles)]},
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
    if user.is_admin and _count_admins(db) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe existir al menos un administrador",
        )

    profile = (
        db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    )

    # Protegemos el historial clínico: no se elimina un usuario con actividad real.
    has_history = (
        db.query(Appointment.id).filter(Appointment.patient_id == user.id).first()
        or db.query(Consultation.id).filter(Consultation.user_id == user.id).first()
        or db.query(ConsultationReview.id).filter(ConsultationReview.patient_id == user.id).first()
        or db.query(VideoSession.id).filter(VideoSession.patient_id == user.id).first()
        or db.query(VideoSessionFile.id).filter(VideoSessionFile.uploader_id == user.id).first()
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

    # Con dinero de por medio, conservamos el rastro: no se elimina un usuario con
    # movimientos de créditos (recargas, pagos, retiros o saldo pendiente).
    wallet_row = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    has_wallet_movement = (
        db.query(WalletTransaction.id).filter(WalletTransaction.user_id == user.id).first()
        is not None
        or db.query(Withdrawal.id).filter(Withdrawal.user_id == user.id).first() is not None
    )
    if wallet_row is not None and (has_wallet_movement or (wallet_row.balance_cents or 0) != 0):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El usuario tiene movimientos de créditos y no puede eliminarse. Suspende su acceso en su lugar.",
        )

    db.query(Favorite).filter(Favorite.user_id == user.id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.user_id == user.id).delete(synchronize_session=False)
    db.query(TriageRequest).filter(TriageRequest.user_id == user.id).delete(synchronize_session=False)
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id
    ).delete(synchronize_session=False)
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id
    ).delete(synchronize_session=False)
    db.query(PatientProfileChangeRequest).filter(
        PatientProfileChangeRequest.patient_id == user.id
    ).delete(synchronize_session=False)
    db.query(PatientProfile).filter(PatientProfile.user_id == user.id).delete(
        synchronize_session=False
    )
    db.query(ReviewReport).filter(ReviewReport.reporter_id == user.id).delete(
        synchronize_session=False
    )
    db.query(ReviewReport).filter(ReviewReport.resolved_by_id == user.id).update(
        {ReviewReport.resolved_by_id: None}, synchronize_session=False
    )
    db.query(ConsultationReview).filter(ConsultationReview.hidden_by_id == user.id).update(
        {ConsultationReview.hidden_by_id: None}, synchronize_session=False
    )
    if wallet_row is not None:
        db.delete(wallet_row)
    if profile:
        # Quitamos referencias al perfil médico antes de borrarlo.
        db.query(Favorite).filter(Favorite.doctor_id == profile.id).delete(
            synchronize_session=False
        )
        db.query(PatientProfileChangeRequest).filter(
            PatientProfileChangeRequest.doctor_profile_id == profile.id
        ).delete(synchronize_session=False)
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
    db.query(Withdrawal).filter(Withdrawal.processed_by_user_id == user.id).update(
        {Withdrawal.processed_by_user_id: None}, synchronize_session=False
    )

    audit_service.log(
        db,
        action="user.deleted",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=current_user.id,
        metadata={"email": user.email, "roles": [role.value for role in sorted_roles(user.roles)]},
    )
    db.delete(user)
    db.commit()
    return None


@router.get("/withdrawals", response_model=WithdrawalListResponse)
def list_withdrawals(
    status_filter: WithdrawalStatus | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Historial de retiros (solo lectura) con filtro opcional por estado y fecha."""
    query = db.query(Withdrawal).options(joinedload(Withdrawal.user))
    if status_filter is not None:
        query = query.filter(Withdrawal.status == status_filter)
    if start is not None:
        query = query.filter(Withdrawal.created_at >= start)
    if end is not None:
        query = query.filter(Withdrawal.created_at <= end)
    withdrawals = query.order_by(Withdrawal.created_at.desc()).all()
    return WithdrawalListResponse(
        withdrawals=[
            WithdrawalResponse(
                id=item.id,
                user_id=item.user_id,
                user_email=item.user.email if item.user else None,
                amount_cents=item.amount_cents,
                status=item.status,
                destination=item.destination,
                provider=item.provider,
                provider_reference=item.provider_reference,
                failure_reason=item.failure_reason,
                admin_notes=item.admin_notes,
                requested_at=item.requested_at,
                processed_at=item.processed_at,
                created_at=item.created_at,
            )
            for item in withdrawals
        ],
        total=len(withdrawals),
    )


# --- Moderación de reseñas ---------------------------------------------------


def _serialize_admin_review(review: ConsultationReview) -> AdminReviewItem:
    return AdminReviewItem(
        id=review.id,
        rating=review.rating,
        comment=review.comment,
        doctor_id=review.doctor_id,
        doctor_name=review.doctor.display_name if review.doctor else None,
        is_hidden=bool(review.is_hidden),
        hidden_reason=review.hidden_reason,
        reports_count=len(review.reports) if review.reports else 0,
        created_at=review.created_at,
    )


def _serialize_admin_report(report: ReviewReport) -> AdminReviewReportItem:
    return AdminReviewReportItem(
        id=report.id,
        review_id=report.review_id,
        reporter_email=report.reporter.email if report.reporter else "",
        reason=report.reason,
        status=report.status,
        created_at=report.created_at,
        resolved_at=report.resolved_at,
        review=_serialize_admin_review(report.review),
    )


@router.get("/review-reports", response_model=AdminReviewReportListResponse)
def list_review_reports(
    report_status: ReviewReportStatus | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = (
        db.query(ReviewReport)
        .options(
            joinedload(ReviewReport.review).joinedload(ConsultationReview.doctor),
            joinedload(ReviewReport.reporter),
        )
        .order_by(ReviewReport.created_at.desc())
    )
    if report_status is not None:
        query = query.filter(ReviewReport.status == report_status)
    reports = query.limit(200).all()
    return AdminReviewReportListResponse(
        reports=[_serialize_admin_report(report) for report in reports],
        total=len(reports),
    )


@router.post("/review-reports/{report_id}/status", response_model=AdminReviewReportItem)
def update_review_report_status(
    report_id: int,
    payload: ReviewReportStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    report = db.query(ReviewReport).filter(ReviewReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado")
    review_service.resolve_report(
        db, report=report, moderator=current_user, new_status=payload.status
    )
    db.refresh(report)
    return _serialize_admin_report(report)


@router.get("/reviews", response_model=AdminReviewListResponse)
def list_reviews_for_moderation(
    hidden: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = (
        db.query(ConsultationReview)
        .options(joinedload(ConsultationReview.doctor))
        .order_by(ConsultationReview.created_at.desc())
    )
    if hidden is not None:
        query = query.filter(ConsultationReview.is_hidden == hidden)
    reviews = query.limit(100).all()
    return AdminReviewListResponse(
        reviews=[_serialize_admin_review(review) for review in reviews],
        total=len(reviews),
    )


@router.post("/reviews/{review_id}/hide", response_model=AdminReviewItem)
def hide_review(
    review_id: int,
    payload: ReviewModerationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    review = db.query(ConsultationReview).filter(ConsultationReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reseña no encontrada")
    review_service.hide_review(
        db, review=review, moderator=current_user, reason=payload.reason
    )
    audit_service.log(
        db,
        action="review.hidden",
        entity_type="consultation_review",
        entity_id=review.id,
        actor_user_id=current_user.id,
        metadata={"reason": payload.reason},
    )
    db.commit()
    db.refresh(review)
    return _serialize_admin_review(review)


@router.post("/reviews/{review_id}/unhide", response_model=AdminReviewItem)
def unhide_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    review = db.query(ConsultationReview).filter(ConsultationReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reseña no encontrada")
    review_service.unhide_review(db, review=review)
    audit_service.log(
        db,
        action="review.unhidden",
        entity_type="consultation_review",
        entity_id=review.id,
        actor_user_id=current_user.id,
    )
    db.commit()
    db.refresh(review)
    return _serialize_admin_review(review)


# ---------------------------------------------------------------------------
# Registro de errores (panel de IT)
# ---------------------------------------------------------------------------
def _error_log_context(entry: ErrorLog) -> dict | None:
    if not entry.context_json:
        return None
    try:
        return json.loads(entry.context_json)
    except (ValueError, TypeError):
        return {"raw": entry.context_json}


def _serialize_error_log(entry: ErrorLog, *, occurrences: int = 1) -> ErrorLogItem:
    return ErrorLogItem(
        id=entry.id,
        created_at=entry.created_at,
        level=entry.level,
        source=entry.source,
        status_code=entry.status_code,
        method=entry.method,
        path=entry.path,
        error_type=entry.error_type,
        message=entry.message,
        user_id=entry.user_id,
        user_email=entry.user_email,
        user_role=entry.user_role,
        request_id=entry.request_id,
        video_session_id=entry.video_session_id,
        appointment_id=entry.appointment_id,
        consultation_id=entry.consultation_id,
        fingerprint=entry.fingerprint,
        occurrences=occurrences,
    )


def _serialize_error_log_detail(entry: ErrorLog) -> ErrorLogDetail:
    occurrences = 1
    if entry.fingerprint:
        occurrences = error_log_service.fingerprint_counts([entry.fingerprint]).get(
            entry.fingerprint, 1
        )
    base = _serialize_error_log(entry, occurrences=occurrences)
    return ErrorLogDetail(
        **base.model_dump(),
        stack_trace=entry.stack_trace,
        context=_error_log_context(entry),
        ip_address=entry.ip_address,
        user_agent=entry.user_agent,
    )


@router.get("/error-logs", response_model=ErrorLogListResponse)
def list_error_logs(
    level: str | None = Query(default=None),
    source: str | None = Query(default=None),
    status_code: int | None = Query(default=None),
    path: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
    video_only: bool = Query(default=False),
    search: str | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Lista los errores registrados con filtros para el equipo de IT."""
    error_log_service.maybe_cleanup()

    def apply_filters(query):
        if level:
            query = query.filter(ErrorLog.level == level)
        if source:
            query = query.filter(ErrorLog.source == source)
        if status_code is not None:
            query = query.filter(ErrorLog.status_code == status_code)
        if path:
            query = query.filter(ErrorLog.path.ilike(f"%{path}%"))
        if user_id is not None:
            query = query.filter(ErrorLog.user_id == user_id)
        if video_only:
            query = query.filter(ErrorLog.video_session_id.isnot(None))
        if search:
            like = f"%{search}%"
            query = query.filter(
                or_(
                    ErrorLog.message.ilike(like),
                    ErrorLog.path.ilike(like),
                    ErrorLog.user_email.ilike(like),
                    ErrorLog.error_type.ilike(like),
                    ErrorLog.request_id.ilike(like),
                )
            )
        if start:
            query = query.filter(ErrorLog.created_at >= start)
        if end:
            query = query.filter(ErrorLog.created_at <= end)
        return query

    base_query = apply_filters(db.query(ErrorLog))
    total = base_query.count()
    entries = (
        base_query.order_by(ErrorLog.created_at.desc(), ErrorLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    counts = error_log_service.fingerprint_counts([entry.fingerprint for entry in entries])
    items = [
        _serialize_error_log(
            entry,
            occurrences=counts.get(entry.fingerprint, 1) if entry.fingerprint else 1,
        )
        for entry in entries
    ]

    summary_query = apply_filters(db.query(ErrorLog))
    now = datetime.now(UTC)
    summary = ErrorLogSummary(
        total=total,
        last_24h=summary_query.filter(ErrorLog.created_at >= now - timedelta(hours=24)).count(),
        video_total=summary_query.filter(ErrorLog.video_session_id.isnot(None)).count(),
        client_total=summary_query.filter(ErrorLog.source == "client").count(),
        backend_total=summary_query.filter(ErrorLog.source == "backend").count(),
    )

    return ErrorLogListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        summary=summary,
    )


@router.get("/error-logs/{error_id}", response_model=ErrorLogDetail)
def get_error_log(
    error_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    entry = db.query(ErrorLog).filter(ErrorLog.id == error_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Error no encontrado")
    return _serialize_error_log_detail(entry)


@router.delete("/error-logs/{error_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_error_log(
    error_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Elimina un error del registro."""
    entry = db.query(ErrorLog).filter(ErrorLog.id == error_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Error no encontrado")
    db.delete(entry)
    db.commit()
    return None


@router.post("/error-logs/bulk-delete", response_model=ErrorLogDeleteResponse)
def bulk_delete_error_logs(
    payload: ErrorLogBulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Elimina varios errores a la vez."""
    ids = list(dict.fromkeys(payload.ids))
    deleted = (
        db.query(ErrorLog)
        .filter(ErrorLog.id.in_(ids))
        .delete(synchronize_session=False)
    )
    db.commit()
    return ErrorLogDeleteResponse(deleted=int(deleted or 0))


@router.post("/error-logs/cleanup", response_model=ErrorLogCleanupResponse)
def cleanup_error_logs(
    days: int | None = Query(default=None, ge=1, le=3650),
    current_user: User = Depends(require_admin),
):
    """Purga manualmente los errores más antiguos que la retención configurada."""
    deleted = error_log_service.cleanup_old(days=days)
    return ErrorLogCleanupResponse(
        deleted=deleted,
        retention_days=days or settings.ERROR_LOG_RETENTION_DAYS,
    )
