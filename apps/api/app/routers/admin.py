import re
import unicodedata
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.deps import get_current_user, get_db, require_admin
from app.core.security import get_password_hash
from app.models.appointment import Appointment, AppointmentStatus
from app.models.audit_log import AuditLog
from app.models.consultation import Consultation
from app.models.consultation_review import ConsultationReview
from app.models.doctor_availability_slot import DoctorAvailabilitySlot
from app.models.doctor_presence import DoctorPresence
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.doctor_specialty import DoctorSpecialty
from app.models.specialty import Specialty
from app.models.favorite import Favorite
from app.models.notification import Notification, NotificationStatus
from app.models.triage_request import TriageRequest
from app.models.user import User, UserRole
from app.models.video_session import VideoSession, VideoSessionStatus
from app.models.wallet import Wallet, WalletTransaction, Withdrawal, WithdrawalStatus
from app.schemas.appointment import (
    AdminIncidentListResponse,
    AdminIncidentResponse,
    AdminLiveVideoSessionListResponse,
    AdminLiveVideoSessionResponse,
    AdminMarketplaceOverviewResponse,
    AppointmentListResponse,
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
from app.services.appointment_service import appointment_service
from app.services.audit_service import audit_service
from app.services.patient_profile_service import get_patient_display_name
from app.services.llm_client import llm_client
from app.services.wallet_service import wallet_service
from app.schemas.wallet import (
    WithdrawalListResponse,
    WithdrawalProcessRequest,
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
        role=user.role,
        doctor_status=profile.status if profile else None,
        is_reviewer=bool(user.is_reviewer),
        created_at=user.created_at,
    )


def _count_admins(db: Session) -> int:
    return db.query(User).filter(User.role == UserRole.admin).count()


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
    if current_user.role != UserRole.admin:
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
    """Citas de todos los medicos, con filtro opcional por estado."""
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
    if current_user.role != UserRole.admin:
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
                doctor_name=session.doctor.display_name if session.doctor else "Medico",
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
        .filter(or_(User.is_reviewer == True, User.role == UserRole.reviewer))
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
        if existing.is_reviewer or existing.role == UserRole.reviewer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este usuario ya es revisor",
            )
        # Damos la capacidad de revisión sin cambiar su rol (puede seguir siendo médico).
        existing.is_reviewer = True
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
            role=UserRole.patient,
            is_reviewer=True,
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
        .filter(
            User.id == user_id,
            or_(User.is_reviewer == True, User.role == UserRole.reviewer),
        )
        .first()
    )
    if not reviewer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Revisor no encontrado",
        )

    reviewer.is_reviewer = False
    restored_role = reviewer.role.value
    if reviewer.role == UserRole.reviewer:
        # Compatibilidad con el rol antiguo: devolvemos a medico o paciente.
        doctor_profile = (
            db.query(DoctorProfile)
            .filter(DoctorProfile.user_id == reviewer.id)
            .first()
        )
        if doctor_profile and doctor_profile.status == DoctorApprovalStatus.approved:
            reviewer.role = UserRole.doctor
            restored_role = "doctor"
        else:
            reviewer.role = UserRole.patient
            restored_role = "patient"
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
    is_reviewer: bool | None = None,
    search: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if is_reviewer is not None:
        query = query.filter(User.is_reviewer == is_reviewer)
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
            detail="El email ya está registrado",
        )

    # Un medico requiere un DoctorProfile (flujo de postulación). Se puede crear
    # la cuenta y luego promoverla cuando el perfil exista.
    if payload.role == UserRole.doctor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Para crear un médico usa el flujo de postulación; luego podrás asignarle el rol",
        )

    # El rol "reviewer" se mantiene por compatibilidad: se traduce a paciente + flag.
    role = UserRole.patient if payload.role == UserRole.reviewer else payload.role
    is_reviewer = payload.is_reviewer or payload.role == UserRole.reviewer

    user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=role,
        is_reviewer=is_reviewer,
    )
    db.add(user)
    db.flush()
    audit_service.log(
        db,
        action="user.created",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=current_user.id,
        metadata={"email": user.email, "role": user.role.value, "is_reviewer": bool(user.is_reviewer)},
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
        # Invalida las sesiones activas del usuario.
        user.session_version = (user.session_version or 1) + 1

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

    if payload.is_reviewer is not None and payload.is_reviewer != user.is_reviewer:
        user.is_reviewer = payload.is_reviewer
        if not payload.is_reviewer and user.role == UserRole.reviewer:
            # Compatibilidad con el rol antiguo.
            profile = (
                db.query(DoctorProfile)
                .filter(DoctorProfile.user_id == user.id)
                .first()
            )
            user.role = (
                UserRole.doctor
                if profile and profile.status == DoctorApprovalStatus.approved
                else UserRole.patient
            )

    audit_service.log(
        db,
        action="user.updated",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=current_user.id,
        metadata={"email": user.email, "role": user.role.value, "is_reviewer": bool(user.is_reviewer)},
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

    # Con dinero de por medio, conservamos el rastro: no se elimina un usuario con
    # movimientos de créditos (recargas, pagos, retiros o saldo pendiente).
    wallet_row = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    has_wallet_movement = (
        db.query(WalletTransaction.id).filter(WalletTransaction.user_id == user.id).first()
        is not None
    )
    if wallet_row is not None and (has_wallet_movement or (wallet_row.balance_cents or 0) != 0):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El usuario tiene movimientos de créditos y no puede eliminarse. Suspende su acceso en su lugar.",
        )

    db.query(Favorite).filter(Favorite.user_id == user.id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.user_id == user.id).delete(synchronize_session=False)
    db.query(TriageRequest).filter(TriageRequest.user_id == user.id).delete(synchronize_session=False)
    if wallet_row is not None:
        db.delete(wallet_row)
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
    db.query(Withdrawal).filter(Withdrawal.processed_by_user_id == user.id).update(
        {Withdrawal.processed_by_user_id: None}, synchronize_session=False
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


@router.get("/withdrawals", response_model=WithdrawalListResponse)
def list_withdrawals(
    status_filter: WithdrawalStatus | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Lista las solicitudes de retiro de créditos para su revisión."""
    query = db.query(Withdrawal).options(joinedload(Withdrawal.user))
    if status_filter is not None:
        query = query.filter(Withdrawal.status == status_filter)
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
                admin_notes=item.admin_notes,
                requested_at=item.requested_at,
                processed_at=item.processed_at,
                created_at=item.created_at,
            )
            for item in withdrawals
        ],
        total=len(withdrawals),
    )


@router.post("/withdrawals/{withdrawal_id}/process", response_model=WithdrawalResponse)
def process_withdrawal(
    withdrawal_id: int,
    payload: WithdrawalProcessRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Aprueba (paga) o rechaza una solicitud de retiro."""
    withdrawal = (
        db.query(Withdrawal)
        .filter(Withdrawal.id == withdrawal_id)
        .with_for_update()
        .first()
    )
    if not withdrawal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud de retiro no encontrada")

    wallet_service.process_withdrawal(
        db,
        withdrawal,
        approve=payload.approve,
        admin_user_id=current_user.id,
        notes=payload.notes,
    )
    audit_service.log(
        db,
        action="withdrawal.processed",
        entity_type="withdrawal",
        entity_id=withdrawal.id,
        actor_user_id=current_user.id,
        metadata={
            "user_id": withdrawal.user_id,
            "amount_cents": withdrawal.amount_cents,
            "approved": payload.approve,
        },
    )
    response = WithdrawalResponse.model_validate(withdrawal)
    db.commit()
    return response
