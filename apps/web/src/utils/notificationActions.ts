import type { NotificationItem } from '../api/notifications'

/**
 * Algunas notificaciones traen una acción redundante (p. ej. "Abrir panel"
 * apuntando al panel donde ya estás). Filtramos esas para no mostrar botones
 * que no llevan a ningún sitio útil.
 */
export function hasUsefulAction(notification: NotificationItem): boolean {
  if (!notification.action_url) return false
  if (notification.action_url === '/doctor') return false
  if ((notification.action_label || '').trim().toLowerCase() === 'abrir panel') return false
  return true
}
