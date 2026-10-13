import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Copy,
  LifeBuoy,
  RefreshCcw,
  Video,
} from 'lucide-react'

import {
  AdminUserSupport as AdminUserSupportData,
  SupportAppointmentItem,
  SupportVideoSessionItem,
  getAdminUserSupport,
} from '../api/admin'
import { getApiErrorMessage } from '../utils/apiError'
import { formatMoney } from '../utils/format'
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONES,
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_STATUS_TONES,
  DOCTOR_STATUS_LABELS,
  ERROR_LEVEL_LABELS,
  PAYMENT_STATUS_LABELS,
  VIDEO_CLOSED_REASON_LABELS,
  VIDEO_SESSION_STATUS_LABELS,
  VIDEO_SESSION_STATUS_TONES,
  WALLET_TRANSACTION_TYPE_LABELS,
  WITHDRAWAL_STATUS_LABELS,
} from '../utils/statusLabels'
import { ROLE_LABELS } from '../utils/roles'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import type { BadgeTone } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'

type TabValue = 'appointments' | 'sessions' | 'consultations' | 'wallet' | 'errors' | 'notifications'

const TABS: { value: TabValue; label: string }[] = [
  { value: 'appointments', label: 'Citas' },
  { value: 'sessions', label: 'Videollamadas' },
  { value: 'consultations', label: 'Consultas IA' },
  { value: 'wallet', label: 'Monedero' },
  { value: 'errors', label: 'Errores' },
  { value: 'notifications', label: 'Notificaciones' },
]

const formatDateTime = (value: string | null) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

const formatDuration = (seconds: number) => {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

const ERROR_LEVEL_TONES: Record<string, BadgeTone> = {
  error: 'danger',
  warning: 'warning',
  info: 'info',
}

function EmptyRow({ children }: { children: string }) {
  return (
    <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{children}</p>
  )
}

function CounterpartLine({
  item,
}: {
  item: { counterpart: { name: string | null; email: string | null; role: string | null } }
}) {
  const { counterpart } = item
  const label = counterpart.role === 'doctor' ? 'Médico' : 'Paciente'
  return (
    <span className="text-slate-600">
      <span className="text-slate-400">{label}: </span>
      {counterpart.name || counterpart.email || '—'}
    </span>
  )
}

export default function AdminUserSupport({ basePath = '/admin/users' }: { basePath?: string }) {
  const { userId: userIdParam } = useParams()
  const navigate = useNavigate()
  const userId = Number(userIdParam)

  const [data, setData] = useState<AdminUserSupportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabValue>('appointments')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isFinite(userId)) {
      setError('Usuario inválido.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await getAdminUserSupport(userId))
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No se pudo cargar la información de soporte.'))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const summaryText = useMemo(() => {
    if (!data) return ''
    const lines = [
      `Usuario #${data.user.id} · ${data.user.email}`,
      `Roles: ${data.user.roles.map((r) => ROLE_LABELS[r]).join(', ')}`,
      `Verificado: ${data.user.is_email_verified ? 'sí' : 'no'} · Registro: ${formatDateTime(data.user.created_at)}`,
      `Saldo: ${formatMoney(data.wallet_balance_cents)}`,
      `Citas: ${data.stats.appointments_total} (${data.stats.appointments_completed} completadas, ${data.stats.appointments_no_show} no asistió)`,
      `Videollamadas: ${data.stats.video_sessions_total} · Consultas IA: ${data.stats.consultations_total} · Errores: ${data.stats.errors_total}`,
    ]
    if (data.active_session) {
      lines.push(
        `SESIÓN ACTIVA #${data.active_session.id} · ${VIDEO_SESSION_STATUS_LABELS[data.active_session.status] ?? data.active_session.status} · sala ${data.active_session.room_name} · con ${data.active_session.counterpart.name || data.active_session.counterpart.email || '—'}`,
      )
    }
    if (data.next_appointment) {
      lines.push(
        `PRÓXIMA CITA #${data.next_appointment.id} · ${formatDateTime(data.next_appointment.scheduled_at)} · ${data.next_appointment.specialty_name} · con ${data.next_appointment.counterpart.name || '—'}`,
      )
    }
    const lastError = data.errors[0]
    if (lastError) {
      lines.push(`ÚLTIMO ERROR: ${lastError.message} (${formatDateTime(lastError.created_at)})`)
    }
    return lines.join('\n')
  }, [data])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* portapapeles no disponible */
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          to={basePath}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a usuarios
        </Link>
        <Alert tone="danger" title="No se pudo cargar el soporte">
          {error ?? 'Usuario no encontrado.'}
        </Alert>
        <Button variant="secondary" onClick={load} leftIcon={<RefreshCcw className="h-4 w-4" />}>
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to={basePath}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a usuarios
      </Link>

      <PageHeader
        icon={LifeBuoy}
        title={data.user.email}
        description={`Soporte · Usuario #${data.user.id}`}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={handleCopy}
              leftIcon={<Copy className="h-4 w-4" />}
            >
              {copied ? 'Copiado' : 'Copiar resumen'}
            </Button>
            <Button
              variant="secondary"
              onClick={load}
              leftIcon={<RefreshCcw className="h-4 w-4" />}
            >
              Actualizar
            </Button>
          </>
        }
      />

      {/* Roles y estado */}
      <div className="flex flex-wrap items-center gap-2">
        {data.user.roles.map((role) => (
          <Badge
            key={role}
            tone={role === 'admin' ? 'primary' : role === 'doctor' ? 'success' : 'neutral'}
          >
            {ROLE_LABELS[role]}
          </Badge>
        ))}
        {data.user.doctor_status && (
          <Badge tone="info">{DOCTOR_STATUS_LABELS[data.user.doctor_status] || 'Sin perfil'}</Badge>
        )}
        <Badge tone={data.user.is_email_verified ? 'success' : 'warning'}>
          {data.user.is_email_verified ? 'Correo verificado' : 'Correo sin verificar'}
        </Badge>
        <Badge tone="neutral">Saldo {formatMoney(data.wallet_balance_cents)}</Badge>
        <Badge tone="neutral">Registro {formatDateTime(data.user.created_at)}</Badge>
      </div>

      {/* En curso / próxima */}
      <div className="grid gap-3 md:grid-cols-2">
        {data.active_session ? (
          <Card className="border-emerald-200 bg-emerald-50/60">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <Video className="h-4 w-4" /> Videollamada activa
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Sesión #{data.active_session.id} ·{' '}
              {VIDEO_SESSION_STATUS_LABELS[data.active_session.status] || data.active_session.status}
            </p>
            <p className="mt-1 text-sm">
              <CounterpartLine item={data.active_session} />
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500">{data.active_session.room_name}</p>
          </Card>
        ) : (
          <Card className="border-slate-200 bg-slate-50">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Video className="h-4 w-4" /> Sin videollamada activa
            </p>
            <p className="mt-2 text-sm text-slate-500">No hay sesiones preparadas o en curso.</p>
          </Card>
        )}

        {data.next_appointment ? (
          <Card className="border-sky-200 bg-sky-50/60">
            <p className="flex items-center gap-2 text-sm font-semibold text-sky-900">
              <CalendarDays className="h-4 w-4" /> Próxima cita
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {data.next_appointment.specialty_name} ·{' '}
              {formatDateTime(data.next_appointment.scheduled_at)}
            </p>
            <p className="mt-1 text-sm">
              <CounterpartLine item={data.next_appointment} />
            </p>
          </Card>
        ) : (
          <Card className="border-slate-200 bg-slate-50">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CalendarDays className="h-4 w-4" /> Sin cita próxima
            </p>
            <p className="mt-2 text-sm text-slate-500">No hay citas programadas a futuro.</p>
          </Card>
        )}
      </div>

      {/* Ficha médica */}
      {data.doctor_profile && (
        <Card>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Perfil médico</p>
          <div className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Nombre" value={data.doctor_profile.display_name} />
            <Info label="Estado" value={DOCTOR_STATUS_LABELS[data.doctor_profile.status] || data.doctor_profile.status} />
            <Info label="Tarifa" value={`${formatMoney(data.doctor_profile.price_per_min_cents)}/min`} />
            <Info
              label="Valoración"
              value={`${data.doctor_profile.rating_avg.toFixed(1)} (${data.doctor_profile.rating_count})`}
            />
            <Info label="Especialidades" value={data.doctor_profile.specialties.join(', ') || '—'} />
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Citas" value={data.stats.appointments_total} />
        <Stat label="Completadas" value={data.stats.appointments_completed} />
        <Stat label="No asistió" value={data.stats.appointments_no_show} />
        <Stat label="Videollamadas" value={data.stats.video_sessions_total} />
        <Stat label="Consultas IA" value={data.stats.consultations_total} />
        <Stat label="Sin leer" value={data.stats.unread_notifications} />
        <Stat label="Errores" value={data.stats.errors_total} />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTab(option.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === option.value ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="min-h-[200px]">
        {tab === 'appointments' && (
          <div className="space-y-2">
            {data.appointments.length === 0 ? (
              <EmptyRow>Sin citas registradas.</EmptyRow>
            ) : (
              data.appointments.map((appointment) => (
                <AppointmentRow key={appointment.id} appointment={appointment} />
              ))
            )}
          </div>
        )}

        {tab === 'sessions' && (
          <div className="space-y-2">
            {data.video_sessions.length === 0 ? (
              <EmptyRow>Sin videollamadas registradas.</EmptyRow>
            ) : (
              data.video_sessions.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))
            )}
          </div>
        )}

        {tab === 'consultations' && (
          <div className="space-y-2">
            {data.consultations.length === 0 ? (
              <EmptyRow>Sin consultas de IA.</EmptyRow>
            ) : (
              data.consultations.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">
                      #{item.id} · {item.specialty_name}
                    </span>
                    <Badge tone={CONSULTATION_STATUS_TONES[item.status] ?? 'neutral'}>
                      {CONSULTATION_STATUS_LABELS[item.status] ?? item.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(item.created_at)}
                    {item.auto_closed ? ' · cerrada automáticamente' : ''}
                    {item.has_summary ? ' · con resumen' : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'wallet' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Movimientos recientes</p>
              {data.transactions.length === 0 ? (
                <EmptyRow>Sin movimientos en el monedero.</EmptyRow>
              ) : (
                data.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{transaction.description}</p>
                      <p className="text-xs text-slate-500">
                        {WALLET_TRANSACTION_TYPE_LABELS[transaction.type] ?? transaction.type} ·{' '}
                        {formatDateTime(transaction.created_at)}
                      </p>
                    </div>
                    <span
                      className={`font-semibold tabular-nums ${
                        transaction.amount_cents >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {transaction.amount_cents >= 0 ? '+' : '−'}
                      {formatMoney(Math.abs(transaction.amount_cents))}
                    </span>
                  </div>
                ))
              )}
            </div>
            {data.withdrawals.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Retiros</p>
                {data.withdrawals.map((withdrawal) => (
                  <div key={withdrawal.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">
                        {formatMoney(withdrawal.amount_cents)}
                      </span>
                      <Badge
                        tone={
                          withdrawal.status === 'paid'
                            ? 'success'
                            : withdrawal.status === 'failed'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {WITHDRAWAL_STATUS_LABELS[withdrawal.status] ?? withdrawal.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Destino: {withdrawal.destination} · {formatDateTime(withdrawal.created_at)}
                    </p>
                    {withdrawal.failure_reason && (
                      <p className="mt-1 text-xs text-rose-600">{withdrawal.failure_reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'errors' && (
          <div className="space-y-2">
            {data.errors.length === 0 ? (
              <EmptyRow>Sin errores registrados para este usuario.</EmptyRow>
            ) : (
              data.errors.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={ERROR_LEVEL_TONES[item.level] ?? 'neutral'}>
                      {ERROR_LEVEL_LABELS[item.level] ?? item.level}
                    </Badge>
                    {item.status_code != null && <Badge tone="neutral">HTTP {item.status_code}</Badge>}
                    <Badge tone={item.source === 'client' ? 'info' : 'primary'}>
                      {item.source === 'client' ? 'Navegador' : 'Servidor'}
                    </Badge>
                    <span className="text-xs text-slate-500">{formatDateTime(item.created_at)}</span>
                  </div>
                  <p className="mt-2 flex items-start gap-2 text-slate-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <span className="break-words">{item.message}</span>
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-400">
                    {item.method ? `${item.method} ` : ''}
                    {item.path || ''}
                    {item.video_session_id ? ` · sesión #${item.video_session_id}` : ''}
                    {item.request_id ? ` · ${item.request_id}` : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'notifications' && (
          <div className="space-y-2">
            {data.notifications.length === 0 ? (
              <EmptyRow>Sin notificaciones.</EmptyRow>
            ) : (
              data.notifications.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{item.title}</span>
                    <span className="text-xs text-slate-500">{formatDateTime(item.created_at)}</span>
                  </div>
                  <p className="mt-1 text-slate-600">{item.body}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div>
        <Button variant="ghost" onClick={() => navigate(basePath)} leftIcon={<ArrowLeft className="h-4 w-4" />}>
          Volver a usuarios
        </Button>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
    </div>
  )
}

function AppointmentRow({ appointment }: { appointment: SupportAppointmentItem }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-slate-800">
          #{appointment.id} · {appointment.specialty_name}
        </span>
        <Badge
          tone={
            APPOINTMENT_STATUS_TONES[
              appointment.status as keyof typeof APPOINTMENT_STATUS_TONES
            ] ?? 'neutral'
          }
        >
          {APPOINTMENT_STATUS_LABELS[
            appointment.status as keyof typeof APPOINTMENT_STATUS_LABELS
          ] ?? appointment.status}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {formatDateTime(appointment.scheduled_at)} · {appointment.duration_minutes} min
      </p>
      <p className="mt-1 text-sm">
        <CounterpartLine item={appointment} />
      </p>
      {appointment.payment_amount_cents != null && (
        <p className="mt-1 text-xs text-slate-500">
          Pago: {formatMoney(appointment.payment_amount_cents)} (
          {PAYMENT_STATUS_LABELS[appointment.payment_status ?? ''] ?? appointment.payment_status})
          {appointment.payment_doctor_amount_cents != null &&
            ` · neto médico ${formatMoney(appointment.payment_doctor_amount_cents)}`}
        </p>
      )}
      {appointment.video_session_id && (
        <p className="mt-1 text-xs text-slate-500">Videoconsulta #{appointment.video_session_id}</p>
      )}
    </div>
  )
}

function SessionRow({ session }: { session: SupportVideoSessionItem }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-slate-800">Sesión #{session.id}</span>
        <Badge tone={VIDEO_SESSION_STATUS_TONES[session.status] ?? 'neutral'}>
          {VIDEO_SESSION_STATUS_LABELS[session.status] ?? session.status}
        </Badge>
      </div>
      <p className="mt-1 text-sm">
        <CounterpartLine item={session} />
      </p>
      <p className="mt-1 font-mono text-xs text-slate-500">{session.room_name}</p>
      <p className="mt-1 text-xs text-slate-500">
        {formatDateTime(session.created_at)}
        {session.started_at ? ` · inició ${formatDateTime(session.started_at)}` : ''}
        {session.ended_at ? ` · terminó ${formatDateTime(session.ended_at)}` : ''}
        {session.billable_seconds > 0 ? ` · facturado ${formatDuration(session.billable_seconds)}` : ''}
        {session.closed_reason
          ? ` · ${VIDEO_CLOSED_REASON_LABELS[session.closed_reason] ?? session.closed_reason}`
          : ''}
      </p>
    </div>
  )
}
