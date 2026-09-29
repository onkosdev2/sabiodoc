"""Etiquetas en español para valores internos (estados, acciones, entidades).

Los valores de los enums se guardan en inglés porque son parte del contrato de
la API, pero nunca deben mostrarse crudos al usuario. Este módulo centraliza su
traducción para notificaciones, paneles y correos.
"""

from app.models.appointment import AppointmentStatus
from app.models.consultation import ConsultationStatus
from app.models.doctor_profile import DoctorApprovalStatus
from app.models.video_session import PaymentStatus, VideoSessionStatus


DOCTOR_APPROVAL_STATUS_LABELS: dict[str, str] = {
    "pending": "Pendiente",
    "approved": "Aprobado",
    "rejected": "Rechazado",
    "suspended": "Suspendido",
}

APPOINTMENT_STATUS_LABELS: dict[str, str] = {
    "scheduled": "Programada",
    "completed": "Completada",
    "cancelled": "Cancelada",
    "no_show": "No asistió",
}

CONSULTATION_STATUS_LABELS: dict[str, str] = {
    "created": "Borrador",
    "active": "Activa",
    "closed": "Cerrada",
}

VIDEO_SESSION_STATUS_LABELS: dict[str, str] = {
    "prepared": "Preparada",
    "active": "En curso",
    "completed": "Finalizada",
    "cancelled": "Cancelada",
    "expired": "Expirada",
    "failed": "Fallida",
}

PAYMENT_STATUS_LABELS: dict[str, str] = {
    "pending": "Pendiente",
    "authorized": "Autorizado",
    "paid": "Pagado",
    "released": "Liquidado",
    "refunded": "Reembolsado",
    "failed": "Fallido",
}

# Acciones de auditoría mostradas en el panel de administración.
AUDIT_ACTION_LABELS: dict[str, str] = {
    "appointment.cancelled": "Cita cancelada",
    "appointment.completed": "Cita completada",
    "appointment.created": "Cita creada",
    "appointment.no_show": "Cita marcada como inasistencia",
    "appointment.rescheduled": "Cita reprogramada",
    "appointment.reviewed": "Cita evaluada",
    "approve": "Aprobación de postulación",
    "doctor_application.reviewed": "Postulación médica revisada",
    "doctor_availability.updated": "Disponibilidad médica actualizada",
    "reject": "Rechazo de postulación",
    "reviewer.revoked": "Revisor revocado",
    "specialty.created": "Especialidad creada",
    "specialty.deleted": "Especialidad eliminada",
    "specialty.updated": "Especialidad actualizada",
    "user.created": "Usuario creado",
    "user.deleted": "Usuario eliminado",
    "user.updated": "Usuario actualizado",
    "video_session.completed": "Videoconsulta finalizada",
    "video_session.doctor_note_updated": "Nota clínica actualizada",
    "withdrawal.processed": "Retiro procesado",
}

AUDIT_ENTITY_LABELS: dict[str, str] = {
    "appointment": "cita",
    "doctor_profile": "perfil médico",
    "specialty": "especialidad",
    "user": "usuario",
    "video_session": "videoconsulta",
    "withdrawal": "retiro",
}


def _label(mapping: dict[str, str], value: object, fallback: str = "") -> str:
    key = getattr(value, "value", value)
    if key is None:
        return fallback
    return mapping.get(str(key), fallback or str(key))


def doctor_approval_status_label(value: object) -> str:
    return _label(DOCTOR_APPROVAL_STATUS_LABELS, value, "Pendiente")


def appointment_status_label(value: object) -> str:
    return _label(APPOINTMENT_STATUS_LABELS, value, "Sin estado")


def consultation_status_label(value: object) -> str:
    return _label(CONSULTATION_STATUS_LABELS, value, "Sin estado")


def video_session_status_label(value: object) -> str:
    return _label(VIDEO_SESSION_STATUS_LABELS, value, "Sin estado")


def audit_action_label(value: object) -> str:
    return _label(AUDIT_ACTION_LABELS, value, "Acción desconocida")


def audit_entity_label(value: object) -> str:
    return _label(AUDIT_ENTITY_LABELS, value, "entidad")


# Reexportados para comodidad de los llamadores.
__all__ = [
    "APPOINTMENT_STATUS_LABELS",
    "AUDIT_ACTION_LABELS",
    "AUDIT_ENTITY_LABELS",
    "CONSULTATION_STATUS_LABELS",
    "DOCTOR_APPROVAL_STATUS_LABELS",
    "PAYMENT_STATUS_LABELS",
    "VIDEO_SESSION_STATUS_LABELS",
    "appointment_status_label",
    "audit_action_label",
    "audit_entity_label",
    "consultation_status_label",
    "doctor_approval_status_label",
    "video_session_status_label",
    "AppointmentStatus",
    "ConsultationStatus",
    "DoctorApprovalStatus",
    "PaymentStatus",
    "VideoSessionStatus",
]
