import type { User, UserRole } from '../api/auth'

export const ROLE_LABELS: Record<UserRole, string> = {
  patient: 'Paciente',
  doctor: 'Médico',
  reviewer: 'Revisor',
  admin: 'Administrador',
  support: 'Soporte',
}

/** Orden de precedencia para mostrar el rol primario. */
export const ROLE_ORDER: UserRole[] = ['admin', 'doctor', 'reviewer', 'support', 'patient']

/** Roles del usuario (con respaldo a ``role`` si el backend no envía ``roles``). */
export function userRoles(user: User | null | undefined): UserRole[] {
  if (!user) return []
  if (user.roles && user.roles.length > 0) return user.roles
  return user.role ? [user.role] : []
}

export function hasRole(user: User | null | undefined, role: UserRole): boolean {
  return userRoles(user).includes(role)
}

export function hasAnyRole(user: User | null | undefined, ...roles: UserRole[]): boolean {
  const current = userRoles(user)
  return roles.some((role) => current.includes(role))
}

/** Etiquetas legibles de todos los roles, en orden de precedencia. */
export function userRoleLabels(user: User | null | undefined): string[] {
  const current = userRoles(user)
  return ROLE_ORDER.filter((role) => current.includes(role)).map((role) => ROLE_LABELS[role])
}
