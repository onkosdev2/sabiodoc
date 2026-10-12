import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'

import { NotificationItem } from '../api/notifications'
import { useNotifications } from '../context/NotificationsContext'
import Button from '../components/ui/Button'
import Pagination from '../components/Pagination'
import { hasUsefulAction } from '../utils/notificationActions'
import {
  NOTIFICATION_CATEGORIES,
  getNotificationMeta,
  type NotificationCategory,
} from '../utils/notificationMeta'
import { usePagination } from '../hooks/usePagination'

type CategoryFilter = NotificationCategory | 'all'

const chipClass = (active: boolean) =>
  `inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
    active ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { notifications, loading, error, refresh, markRead, markAllRead } = useNotifications()
  const [category, setCategory] = useState<CategoryFilter>('all')

  // Solo mostramos filtros de las categorías que realmente tienen notificaciones.
  const categoriesPresent = useMemo(() => {
    const present = new Set(notifications.map((item) => getNotificationMeta(item.type).id))
    return NOTIFICATION_CATEGORIES.filter((config) => present.has(config.id))
  }, [notifications])

  const filtered = useMemo(
    () =>
      category === 'all'
        ? notifications
        : notifications.filter((item) => getNotificationMeta(item.type).id === category),
    [notifications, category],
  )

  const { page, setPage, pageItems, totalPages, totalItems, pageSize } = usePagination(
    filtered,
    10,
    category,
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  // Si la categoría activa se queda sin elementos, volvemos a "Todas".
  useEffect(() => {
    if (category !== 'all' && !categoriesPresent.some((config) => config.id === category)) {
      setCategory('all')
    }
  }, [category, categoriesPresent])

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

      {!loading && !error && notifications.length > 0 && categoriesPresent.length > 0 && (
        <div
          role="tablist"
          aria-label="Filtrar por categoría"
          className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={category === 'all'}
            onClick={() => setCategory('all')}
            className={chipClass(category === 'all')}
          >
            Todas
          </button>
          {categoriesPresent.map((config) => {
            const Icon = config.icon
            const active = category === config.id
            return (
              <button
                key={config.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(config.id)}
                className={chipClass(active)}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {config.label}
              </button>
            )
          })}
        </div>
      )}

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
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-slate-500">
          No hay notificaciones en esta categoría.
        </div>
      ) : (
        <div className="space-y-3">
          {pageItems.map((notification) => {
            const meta = getNotificationMeta(notification.type)
            const Icon = meta.icon
            const unread = notification.status === 'unread'
            return (
              <div
                key={notification.id}
                className={`relative overflow-hidden rounded-2xl border border-slate-200 p-5 ${
                  unread ? 'bg-primary-50' : 'bg-white'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 w-1 ${meta.accentClass}`}
                />
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <span
                      aria-hidden="true"
                      className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${meta.chipClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        {unread && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary-600" aria-hidden="true" />
                            Nueva
                          </span>
                        )}
                      </div>
                      <p className={`mt-2 text-sm ${unread ? 'font-semibold' : 'font-medium'} text-slate-900`}>
                        {notification.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{notification.body}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">
                        {new Date(notification.created_at).toLocaleString('es-ES')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hasUsefulAction(notification) && (
                      <Button variant="secondary" onClick={() => handleOpenNotification(notification)}>
                        {notification.action_label || 'Abrir'}
                      </Button>
                    )}
                    {unread && (
                      <Button variant="ghost" onClick={() => handleMarkRead(notification.id)}>
                        Marcar leída
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
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
