import type { User } from '../api/auth'
import { hasRole } from './roles'

/**
 * Devuelve la ruta "inicio" del usuario segun sus roles y capacidades.
 * Se usa para que botones como "Volver al menu" lleven al panel correcto
 * (dashboard del medico, panel admin/revisor o portal de paciente).
 */
export function getHomePath(user: User | null | undefined): string {
  if (!user) return '/'
  if (user.doctor_status === 'approved') return '/doctor'
  if (hasRole(user, 'admin')) return '/admin'
  if (hasRole(user, 'reviewer')) return '/reviewer/doctor-applications'
  if (hasRole(user, 'support')) return '/support/tickets'
  if (hasRole(user, 'doctor') || user.doctor_status) return '/doctor/pending'
  return '/'
}

/**
 * Ruta "inicio" segun la seccion en la que se encuentra el usuario.
 *
 * Un medico o admin tambien usa el portal de paciente; si esta en una pagina
 * de ese portal (`/me/...`, `/specialties`, `/guide`, etc.) el boton "Volver al
 * menu" debe regresar al portal general y no a su panel profesional.
 */
export function getSectionHomePath(pathname: string, user: User | null | undefined): string {
  if (pathname.startsWith('/admin')) return '/admin'
  if (pathname.startsWith('/reviewer')) return '/reviewer/doctor-applications'
  if (pathname.startsWith('/doctor')) {
    return user?.doctor_status === 'approved' ? '/doctor' : '/doctor/pending'
  }
  // Todo lo demas pertenece al portal general (paciente).
  return '/'
}
