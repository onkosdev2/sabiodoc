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
