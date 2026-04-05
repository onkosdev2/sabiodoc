from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.audit_log import AuditLog
from app.models.doctor_presence import DoctorPresence, DoctorPresenceStatus
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.notification import Notification, NotificationStatus
from app.models.user import User, UserRole
from app.models.video_session import VideoSession, VideoSessionStatus
from app.schemas.appointment import (
    AdminIncidentListResponse,
    AdminIncidentResponse,
    AdminLiveVideoSessionListResponse,
    AdminLiveVideoSessionResponse,
    AdminMarketplaceOverviewResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


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
