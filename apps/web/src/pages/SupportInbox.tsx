import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Inbox, RefreshCcw, UserCheck } from 'lucide-react'

import {
  SupportTicket,
  SupportTicketCategory,
  SupportTicketDetail,
  SupportTicketPriority,
  SupportTicketStatus,
  getSupportInbox,
  getSupportTicket,
  updateSupportTicket,
} from '../api/support'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import {
  SUPPORT_TICKET_CATEGORY_LABELS,
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_PRIORITY_TONES,
  SUPPORT_TICKET_STATUS_LABELS,
  SUPPORT_TICKET_STATUS_TONES,
} from '../utils/statusLabels'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Input, Select } from '../components/ui/Field'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import SupportTicketThread from '../components/SupportTicketThread'

const STATUS_OPTIONS: SupportTicketStatus[] = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed']
const PRIORITY_OPTIONS: SupportTicketPriority[] = ['low', 'normal', 'high', 'urgent']
const CATEGORY_OPTIONS: SupportTicketCategory[] = ['account', 'payments', 'video', 'app_error', 'other']

export default function SupportInbox() {
  const { user } = useAuth()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<'' | SupportTicketStatus>('')
  const [categoryFilter, setCategoryFilter] = useState<'' | SupportTicketCategory>('')
  const [priorityFilter, setPriorityFilter] = useState<'' | SupportTicketPriority>('')
  const [search, setSearch] = useState('')

  const [selected, setSelected] = useState<SupportTicketDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadInbox = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getSupportInbox({
        status_filter: statusFilter || undefined,
        category: categoryFilter || undefined,
        priority: priorityFilter || undefined,
        search: search.trim() || undefined,
      })
      setTickets(response.tickets)
      setOpenCount(response.open_count)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar los tickets.'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter, priorityFilter, search])

  const openTicket = useCallback(
    async (ticketId: number) => {
      setDetailLoading(true)
      try {
        setSelected(await getSupportTicket(ticketId))
      } catch (err: unknown) {
        toast.error(getApiErrorMessage(err, 'No se pudo abrir el ticket.'))
      } finally {
        setDetailLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    loadInbox()
  }, [loadInbox])

  useEffect(() => {
    const raw = searchParams.get('ticket')
    if (!raw) return
    const ticketId = Number(raw)
    if (Number.isFinite(ticketId)) {
      openTicket(ticketId)
    }
  }, [searchParams, openTicket])

  const handleUpdate = async (
    payload: { status?: SupportTicketStatus; priority?: SupportTicketPriority; assigned_to_user_id?: number },
  ) => {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await updateSupportTicket(selected.id, payload)
      setSelected(updated)
      await loadInbox()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'No se pudo actualizar el ticket.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Inbox}
        title="Tickets de soporte"
        description={`Bandeja de entrada de solicitudes de pacientes y médicos. Abiertos: ${openCount}.`}
        actions={
          <Button
            variant="secondary"
            onClick={loadInbox}
            disabled={loading}
            leftIcon={<RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Recargar
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Buscar"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Asunto, referencia o correo"
          />
          <Select
            label="Estado"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as '' | SupportTicketStatus)}
          >
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SUPPORT_TICKET_STATUS_LABELS[option]}
              </option>
            ))}
          </Select>
          <Select
            label="Categoría"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as '' | SupportTicketCategory)}
          >
            <option value="">Todas</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SUPPORT_TICKET_CATEGORY_LABELS[option]}
              </option>
            ))}
          </Select>
          <Select
            label="Prioridad"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as '' | SupportTicketPriority)}
          >
            <option value="">Todas</option>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SUPPORT_TICKET_PRIORITY_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{tickets.length} tickets</p>
          <div className="mt-3 space-y-2">
            {loading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : error ? (
              <Alert tone="danger">{error}</Alert>
            ) : tickets.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No hay tickets para estos filtros.
              </p>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSearchParams({ ticket: String(ticket.id) })}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selected?.id === ticket.id
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">{ticket.reference}</span>
                    <Badge tone={SUPPORT_TICKET_STATUS_TONES[ticket.status] ?? 'neutral'}>
                      {SUPPORT_TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-700">{ticket.subject}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {ticket.user_email || ticket.user_name || 'Usuario'} ·{' '}
                    {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone={SUPPORT_TICKET_PRIORITY_TONES[ticket.priority] ?? 'neutral'}>
                      {SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                    </Badge>
                    <span className="text-[11px] text-slate-400">
                      {new Date(ticket.updated_at || ticket.created_at || '').toLocaleDateString('es-ES')}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card>
          {detailLoading || !selected ? (
            <div className="flex min-h-[300px] items-center justify-center text-center text-slate-500">
              {detailLoading ? <Skeleton className="h-40 w-full rounded-xl" /> : 'Selecciona un ticket para ver su conversación.'}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selected.reference} · {selected.subject}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {selected.user_name || 'Usuario'} · {selected.user_email}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {SUPPORT_TICKET_CATEGORY_LABELS[selected.category]} · Creado{' '}
                    {new Date(selected.created_at || '').toLocaleString('es-ES')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={SUPPORT_TICKET_PRIORITY_TONES[selected.priority] ?? 'neutral'}>
                    {SUPPORT_TICKET_PRIORITY_LABELS[selected.priority] ?? selected.priority}
                  </Badge>
                  <Badge tone={SUPPORT_TICKET_STATUS_TONES[selected.status] ?? 'neutral'}>
                    {SUPPORT_TICKET_STATUS_LABELS[selected.status] ?? selected.status}
                  </Badge>
                </div>
              </div>

              {/* Controles de soporte */}
              <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <Select
                  label="Estado"
                  value={selected.status}
                  onChange={(event) =>
                    handleUpdate({ status: event.target.value as SupportTicketStatus })
                  }
                  disabled={saving}
                  containerClassName="w-44"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {SUPPORT_TICKET_STATUS_LABELS[option]}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Prioridad"
                  value={selected.priority}
                  onChange={(event) =>
                    handleUpdate({ priority: event.target.value as SupportTicketPriority })
                  }
                  disabled={saving}
                  containerClassName="w-40"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {SUPPORT_TICKET_PRIORITY_LABELS[option]}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  onClick={() => user && handleUpdate({ assigned_to_user_id: user.id })}
                  disabled={saving || selected.assigned_to_user_id === user?.id}
                  leftIcon={<UserCheck className="h-4 w-4" />}
                >
                  {selected.assigned_to_user_id === user?.id ? 'Asignado a ti' : 'Asignarme'}
                </Button>
              </div>

              {selected.context && (
                <details className="mt-3 rounded-xl border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">
                    Contexto técnico
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                    {JSON.stringify(selected.context, null, 2)}
                  </pre>
                </details>
              )}

              <div className="mt-4">
                <SupportTicketThread
                  ticket={selected}
                  onReplied={() => {
                    openTicket(selected.id)
                    loadInbox()
                  }}
                  replyHint="La respuesta se envía al usuario y el ticket pasa a «Esperando al usuario»."
                />
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Leyenda de uso */}
      <Card>
        <h2 className="text-base font-semibold text-slate-900">Cómo usar los estados y prioridades</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Estados</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              <li>
                <span className="font-semibold text-slate-800">Abierto:</span> recién creado o reabierto;
                pendiente de atención.
              </li>
              <li>
                <span className="font-semibold text-slate-800">En proceso:</span> soporte lo está
                investigando.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Esperando al usuario:</span> ya respondimos
                y falta la respuesta del usuario.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Resuelto:</span> lo consideramos
                solucionado; si el usuario responde, se reabre.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Cerrado:</span> final; no admite más
                respuestas (para retomarlo, se reabre o se crea otro ticket).
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Prioridades</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              <li>
                <span className="font-semibold text-slate-800">Baja:</span> consulta general, duda o
                sugerencia.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Normal:</span> incidencia estándar que no
                bloquea al usuario.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Alta:</span> bloquea una función clave
                (p. ej. no puede entrar a la videollamada).
              </li>
              <li>
                <span className="font-semibold text-slate-800">Urgente:</span> afecta a la
                seguridad/salud o a muchos usuarios; atención inmediata.
              </li>
            </ul>
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              La prioridad se sugiere de forma automática según la categoría: «Videoconsulta» y «Error de
              la app» entran como Alta.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
