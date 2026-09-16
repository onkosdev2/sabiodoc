import type { User } from '../api/auth'

/**
 * Devuelve la ruta "inicio" del usuario segun su rol y capacidades.
 * Se usa para que botones como "Volver al menu" lleven al panel correcto
 * (dashboard del medico, panel admin/revisor o portal de paciente).
 */
export function getHomePath(user: User | null | undefined): string {
  if (!user) return '/'
  if (user.doctor_status === 'approved') return '/doctor'
  if (user.role === 'admin') return '/admin'
  if (user.role === 'reviewer') return '/reviewer/doctor-applications'
  if (user.role === 'doctor' || user.doctor_status) return '/doctor/pending'
  return '/'
}
