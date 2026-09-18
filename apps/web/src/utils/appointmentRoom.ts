import type { Appointment } from '../api/appointments'

export interface RoomAvailability {
  enabled: boolean
  label: string
}

/** Ventana de acceso a la sala: 60 min antes → duración + 180 min después. */
export function getRoomAvailability(appointment: Appointment): RoomAvailability {
  if (appointment.status !== 'scheduled') {
    return { enabled: false, label: 'Sala no disponible' }
  }

  const now = Date.now()
  const scheduledAt = new Date(appointment.scheduled_at).getTime()
  const openAt = scheduledAt - 60 * 60 * 1000
  const closeAt = scheduledAt + (appointment.duration_minutes + 180) * 60 * 1000

  if (now < openAt) {
    return { enabled: false, label: 'Disponible 60 min antes' }
  }
  if (now > closeAt) {
    return { enabled: false, label: 'Ventana cerrada' }
  }
  return { enabled: true, label: 'Entrar a la sala' }
}
