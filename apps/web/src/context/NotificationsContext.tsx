import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react'

import {
  getMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  streamNotifications,
  NotificationItem,
} from '../api/notifications'
import { getStoredToken } from '../utils/authStorage'
import { useAuth } from './AuthContext'

interface NotificationsContextType {
  notifications: NotificationItem[]
  unread: number
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  markRead: (notificationId: number) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

const MAX_NOTIFICATIONS = 50
// Si el stream SSE falla repetidamente, se usa polling como respaldo.
const FALLBACK_POLL_MS = 120_000
const MAX_STREAM_RETRIES = 5

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const notificationsRef = useRef<NotificationItem[]>([])
  const isMounted = useRef(true)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  // Mantiene la lista sincronizada en un ref para poder actualizarla sin
  // depender de closures obsoletos.
  const applyNotifications = useCallback((next: NotificationItem[]) => {
    notificationsRef.current = next
    setNotifications(next)
    setUnread(next.filter((item) => item.status === 'unread').length)
  }, [])

  const refresh = useCallback(async () => {
    if (!getStoredToken()) {
      applyNotifications([])
      return
    }

    if (!hasLoadedRef.current) setLoading(true)
    try {
      const response = await getMyNotifications()
      if (!isMounted.current) return
      notificationsRef.current = response.notifications
      setNotifications(response.notifications)
      setUnread(response.unread)
      setError(null)
    } catch (err: any) {
      if (!isMounted.current) return
      setError(err.response?.data?.detail || 'No se pudieron cargar las notificaciones')
    } finally {
      if (isMounted.current) {
        hasLoadedRef.current = true
        setLoading(false)
      }
    }
  }, [applyNotifications])

  // Inserta una notificación recibida por SSE sin duplicarla.
  const applyIncoming = useCallback(
    (notification: NotificationItem) => {
      const current = notificationsRef.current
      if (current.some((item) => item.id === notification.id)) return
      applyNotifications([notification, ...current].slice(0, MAX_NOTIFICATIONS))
    },
    [applyNotifications],
  )

  const markRead = useCallback(
    async (notificationId: number) => {
      const updated = await markNotificationAsRead(notificationId)
      applyNotifications(
        notificationsRef.current.map((item) => (item.id === notificationId ? updated : item)),
      )
    },
    [applyNotifications],
  )

  const markAllRead = useCallback(async () => {
    await markAllNotificationsAsRead()
    // Mantenemos el orden actual y solo actualizamos el estado a leída.
    applyNotifications(notificationsRef.current.map((item) => ({ ...item, status: 'read' })))
  }, [applyNotifications])

  useEffect(() => {
    if (!isAuthenticated) {
      applyNotifications([])
      setError(null)
      setLoading(false)
      hasLoadedRef.current = false
      return
    }

    refresh()

    const controller = new AbortController()
    let cancelled = false
    let retry = 0
    const timers: number[] = []
    let fallbackTimer: number | undefined

    const schedule = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms))
    }

    const startFallback = () => {
      if (fallbackTimer !== undefined) return
      fallbackTimer = window.setInterval(refresh, FALLBACK_POLL_MS)
    }
    const stopFallback = () => {
      if (fallbackTimer !== undefined) {
        window.clearInterval(fallbackTimer)
        fallbackTimer = undefined
      }
    }

    const connect = async () => {
      if (cancelled) return
      try {
        await streamNotifications(applyIncoming, controller.signal)
        retry = 0
      } catch {
        if (cancelled || controller.signal.aborted) return
      }
      if (cancelled) return

      retry += 1
      if (retry <= MAX_STREAM_RETRIES) {
        // Reconexión con backoff exponencial.
        schedule(connect, Math.min(30_000, 1_000 * 2 ** retry))
      } else {
        // El stream no está disponible: red de seguridad con polling.
        startFallback()
        schedule(connect, 300_000)
      }
    }

    connect()

    const handleFocus = () => refresh()
    window.addEventListener('focus', handleFocus)

    return () => {
      cancelled = true
      controller.abort()
      stopFallback()
      timers.forEach((id) => window.clearTimeout(id))
      window.removeEventListener('focus', handleFocus)
    }
  }, [isAuthenticated, refresh, applyIncoming, applyNotifications])

  return (
    <NotificationsContext.Provider
      value={{ notifications, unread, loading, error, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return context
}
