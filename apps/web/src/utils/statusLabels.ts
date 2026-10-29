import type { AppointmentStatus } from '../api/appointments'

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Programada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
}

export type StatusTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

export const APPOINTMENT_STATUS_TONES: Record<AppointmentStatus, StatusTone> = {
  scheduled: 'info',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'warning',
}

export const DOCTOR_APPLICATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  suspended: 'Suspendido',
}

/** Estado del perfil médico tal como se muestra en el panel de usuarios. */
export const DOCTOR_STATUS_LABELS: Record<string, string> = {
  pending: 'perfil pendiente',
  approved: 'perfil aprobado',
  rejected: 'perfil rechazado',
  suspended: 'perfil suspendido',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente de cobro',
  paid: 'Cobrado',
  failed: 'Rechazado',
  refunded: 'Reembolsado',
  partially_refunded: 'Reembolsado parcialmente',
  cancelled: 'Cancelado',
}

export const PAYMENT_TRANSACTION_STATUS_LABELS: Record<string, string> = {
  requires_action: 'Requiere verificación',
  processing: 'Procesando',
  succeeded: 'Aprobado',
  failed: 'Rechazado',
  refunded: 'Reembolsado',
  partially_refunded: 'Reembolsado parcialmente',
  disputed: 'En disputa',
  cancelled: 'Cancelado',
}

export const ERROR_LEVEL_LABELS: Record<string, string> = {
  error: 'Error',
  warning: 'Advertencia',
  info: 'Info',
}

export const VIDEO_CLOSED_REASON_LABELS: Record<string, string> = {
  completed_by_doctor: 'Finalizada por el médico',
  completed_from_room: 'Finalizada desde la sala',
  expired_inactivity: 'Expirada por inactividad',
  auto_closed_inactivity: 'Cerrada automáticamente por inactividad',
}

export const SUPPORT_TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'Abierto',
  in_progress: 'En proceso',
  waiting_user: 'Esperando al usuario',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

export const SUPPORT_TICKET_STATUS_TONES: Record<string, StatusTone> = {
  open: 'info',
  in_progress: 'warning',
  waiting_user: 'warning',
  resolved: 'success',
  closed: 'neutral',
}

export const SUPPORT_TICKET_CATEGORY_LABELS: Record<string, string> = {
  account: 'Cuenta',
  payments: 'Pagos',
  video: 'Videoconsulta',
  app_error: 'Error de la app',
  other: 'Otro',
}

export const SUPPORT_TICKET_PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
}

export const SUPPORT_TICKET_PRIORITY_TONES: Record<string, StatusTone> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
}

export const CONSULTATION_STATUS_LABELS: Record<string, string> = {
  created: 'Borrador',
  active: 'Activa',
  closed: 'Cerrada',
}

export const CONSULTATION_STATUS_TONES: Record<string, StatusTone> = {
  created: 'info',
  active: 'success',
  closed: 'neutral',
}

export const VIDEO_SESSION_STATUS_LABELS: Record<string, string> = {
  prepared: 'Preparada',
  active: 'En curso',
  extension_pending: 'Tiempo agotado',
  extension_requested: 'Ampliación por confirmar',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
  expired: 'Expirada',
  failed: 'Fallida',
}

export const VIDEO_SESSION_STATUS_TONES: Record<string, StatusTone> = {
  prepared: 'info',
  active: 'success',
  extension_pending: 'warning',
  extension_requested: 'warning',
  completed: 'neutral',
  cancelled: 'danger',
  expired: 'warning',
  failed: 'danger',
}
