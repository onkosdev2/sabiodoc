import client, { API_URL } from './client'
import { getStoredToken } from '../utils/authStorage'

export interface NotificationItem {
  id: number
  type: string
  title: string
  body: string
  action_url: string | null
  action_label: string | null
  status: 'unread' | 'read'
  created_at: string
  read_at: string | null
  metadata: Record<string, unknown> | null
}

export interface NotificationListResponse {
  notifications: NotificationItem[]
  total: number
  unread: number
}

export const getMyNotifications = async (): Promise<NotificationListResponse> => {
  const response = await client.get<NotificationListResponse>('/notifications/my')
  return response.data
}

export const markNotificationAsRead = async (notificationId: number): Promise<NotificationItem> => {
  const response = await client.post<NotificationItem>(`/notifications/${notificationId}/read`)
  return response.data
}

export const markAllNotificationsAsRead = async (): Promise<NotificationListResponse> => {
  const response = await client.post<NotificationListResponse>('/notifications/read-all')
  return response.data
}

function parseSseEvent(chunk: string): { event: string; data: string } | null {
  let event = 'message'
  const dataLines: string[] = []

  for (const rawLine of chunk.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }

  if (dataLines.length === 0) return null
  return { event, data: dataLines.join('\n') }
}

/**
 * Abre el stream SSE de notificaciones del usuario. Resuelve cuando el stream
 * se cierra (o rechaza si falla). Usa `fetch` en lugar de `EventSource` porque
 * necesita enviar el token Bearer en la cabecera Authorization.
 */
export async function streamNotifications(
  onNotification: (notification: NotificationItem) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = getStoredToken()
  const response = await fetch(`${API_URL}/notifications/stream`, {
    headers: {
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  })

  if (response.status === 401) {
    window.dispatchEvent(new Event('sabiodoc:unauthorized'))
    throw new Error('No autorizado')
  }
  if (!response.ok || !response.body) {
    throw new Error('No se pudo abrir el stream de notificaciones')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let separator = buffer.indexOf('\n\n')
      while (separator !== -1) {
        const chunk = buffer.slice(0, separator)
        buffer = buffer.slice(separator + 2)

        const parsed = parseSseEvent(chunk)
        if (parsed?.event === 'notification' && parsed.data) {
          try {
            onNotification(JSON.parse(parsed.data) as NotificationItem)
          } catch {
            /* ignora payloads inválidos */
          }
        }

        separator = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}
