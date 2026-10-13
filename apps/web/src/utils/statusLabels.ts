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
  held: 'Retenido',
  released: 'Liquidado',
  refunded: 'Reembolsado',
}

export const WALLET_TRANSACTION_TYPE_LABELS: Record<string, string> = {
  topup: 'Recarga',
  withdrawal: 'Retiro',
  consultation_payment: 'Pago de consulta',
  consultation_income: 'Ingreso por consulta',
  refund: 'Reembolso',
  adjustment: 'Ajuste',
}

export const WALLET_TRANSACTION_STATUS_LABELS: Record<string, string> = {
  completed: 'Completado',
  pending: 'Pendiente',
  reversed: 'Revertido',
}

export const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'En proceso',
  paid: 'Pagado',
  failed: 'Fallido',
  rejected: 'Rechazado',
}

export const ERROR_LEVEL_LABELS: Record<string, string> = {
  error: 'Error',
  warning: 'Advertencia',
  info: 'Info',
}

export const VIDEO_CLOSED_REASON_LABELS: Record<string, string> = {
  completed_no_credits: 'Finalizada por falta de créditos',
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
  payments: 'Pagos y créditos',
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
  completed: 'Finalizada',
  cancelled: 'Cancelada',
  expired: 'Expirada',
  failed: 'Fallida',
}

export const VIDEO_SESSION_STATUS_TONES: Record<string, StatusTone> = {
  prepared: 'info',
  active: 'success',
  completed: 'neutral',
  cancelled: 'danger',
  expired: 'warning',
  failed: 'danger',
}
