import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'

import { getMyNotifications, markAllNotificationsAsRead, markNotificationAsRead, NotificationItem } from '../api/notifications'

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadNotifications = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getMyNotifications()
      setNotifications(response.notifications)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'No se pudieron cargar las notificaciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const handleMarkRead = async (notificationId: number) => {
    const updated = await markNotificationAsRead(notificationId)
    setNotifications((current) => current.map((item) => (item.id === notificationId ? updated : item)))
  }

  const handleOpenNotification = async (notification: NotificationItem) => {
    if (notification.status === 'unread') {
      await handleMarkRead(notification.id)
    }
    if (notification.action_url) {
      navigate(notification.action_url)
    }
  }

  const handleMarkAllRead = async () => {
    const updated = await markAllNotificationsAsRead()
    setNotifications(updated.notifications)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notificaciones</h1>
          <p className="mt-2 text-gray-600">Recordatorios, cambios de estado y eventos clínicos relevantes.</p>
        </div>
        <button
          onClick={handleMarkAllRead}
          className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-900"
        >
          <CheckCheck className="h-4 w-4" />
          Marcar todo como leído
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Cargando notificaciones...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : notifications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center text-gray-500">
          <Bell className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          No tienes notificaciones todavía.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-3xl border p-5 ${notification.status === 'unread' ? 'border-primary-200 bg-primary-50' : 'border-gray-200 bg-white'}`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                  <p className="mt-2 text-sm text-gray-600">{notification.body}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.22em] text-gray-400">
                    {new Date(notification.created_at).toLocaleString('es-ES')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {notification.action_url && (
                    <button
                      onClick={() => handleOpenNotification(notification)}
                      className="inline-flex items-center justify-center rounded-full border border-primary-300 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-white"
                    >
                      {notification.action_label || 'Abrir'}
                    </button>
                  )}
                  {notification.status === 'unread' && (
                    <button
                      onClick={() => handleMarkRead(notification.id)}
                      className="inline-flex items-center justify-center rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white"
                    >
                      Marcar leída
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
