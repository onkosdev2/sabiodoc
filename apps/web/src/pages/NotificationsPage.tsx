import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'

import { NotificationItem } from '../api/notifications'
import { useNotifications } from '../context/NotificationsContext'
import Button from '../components/ui/Button'
import Pagination from '../components/Pagination'
import { hasUsefulAction } from '../utils/notificationActions'
import { usePagination } from '../hooks/usePagination'

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { notifications, loading, error, refresh, markRead, markAllRead } = useNotifications()
  const { page, setPage, pageItems, totalPages, totalItems, pageSize } = usePagination(notifications, 10)

  useEffect(() => {
    refresh()
  }, [refresh])

  // Al abrir cualquiera de las páginas de notificaciones, todo lo visible queda
  // marcado como leído (y también lo que llegue mientras la página sigue abierta).
  useEffect(() => {
    if (loading) return
    if (notifications.some((item) => item.status === 'unread')) {
      markAllRead().catch(() => {})
    }
  }, [loading, notifications, markAllRead])

  const handleMarkRead = async (notificationId: number) => {
    await markRead(notificationId)
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
    await markAllRead()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Notificaciones</h1>
          <p className="mt-2 text-slate-600">Recordatorios, cambios de estado y eventos clínicos relevantes.</p>
        </div>
        <Button variant="secondary" onClick={handleMarkAllRead} leftIcon={<CheckCheck className="h-4 w-4" />}>
          Marcar todo como leído
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Cargando notificaciones...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-slate-500">
          <Bell className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          No tienes notificaciones todavía.
        </div>
      ) : (
        <div className="space-y-3">
          {pageItems.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-2xl border p-5 ${notification.status === 'unread' ? 'border-primary-200 bg-primary-50' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{notification.body}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">
                    {new Date(notification.created_at).toLocaleString('es-ES')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {hasUsefulAction(notification) && (
                    <Button variant="secondary" onClick={() => handleOpenNotification(notification)}>
                      {notification.action_label || 'Abrir'}
                    </Button>
                  )}
                  {notification.status === 'unread' && (
                    <Button variant="ghost" onClick={() => handleMarkRead(notification.id)}>
                      Marcar leída
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}
