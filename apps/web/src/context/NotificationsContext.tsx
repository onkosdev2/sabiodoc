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
  NotificationItem,
} from '../api/notifications'
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

// Las notificaciones se refrescan periódicamente para reflejar eventos nuevos
// (recordatorios, cambios de cita, etc.) sin recargar la página.
const POLL_INTERVAL_MS = 60_000

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
    if (!localStorage.getItem('token')) {
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
    const response = await markAllNotificationsAsRead()
    applyNotifications(response.notifications)
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
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    const handleFocus = () => refresh()

    window.addEventListener('focus', handleFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [isAuthenticated, refresh, applyNotifications])

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
