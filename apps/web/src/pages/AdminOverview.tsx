import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ChevronRight, RefreshCcw } from 'lucide-react'

import {
  AdminIncident,
  AdminLiveVideoSession,
  getAdminIncidents,
  getLiveVideoSessions,
  getMarketplaceOverview,
  MarketplaceOverview,
} from '../api/admin'
import { VIDEO_SESSION_STATUS_LABELS, VIDEO_SESSION_STATUS_TONES } from '../utils/statusLabels'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  video_session: 'Videoconsulta',
  appointment_no_show: 'No asistió',
  audit: 'Auditoría',
}

export default function AdminOverview() {
  const toast = useToast()
  const [overview, setOverview] = useState<MarketplaceOverview | null>(null)
  const [liveSessions, setLiveSessions] = useState<AdminLiveVideoSession[]>([])
  const [incidents, setIncidents] = useState<AdminIncident[]>([])
  const [loading, setLoading] = useState(true)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const [overviewResponse, liveSessionsResponse, incidentsResponse] = await Promise.all([
        getMarketplaceOverview(),
        getLiveVideoSessions(),
        getAdminIncidents(),
      ])
      setOverview(overviewResponse)
      setLiveSessions(liveSessionsResponse.sessions)
      setIncidents(incidentsResponse.incidents)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar el panel operativo'))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel operativo"
        description="Resumen del marketplace, videoconsultas en curso e incidentes recientes."
        actions={
          <Button
            variant="secondary"
            onClick={loadDashboard}
            disabled={loading}
            leftIcon={<RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            {loading ? 'Recargando...' : 'Recargar'}
          </Button>
        }
      />

      {loading || !overview ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <OverviewCard label="Médicos en línea" value={String(overview.doctors_online)} to="/admin/users?role=doctor" />
          <OverviewCard label="Médicos ocupados" value={String(overview.doctors_busy)} to="/admin/users?role=doctor" />
          <OverviewCard label="Citas programadas" value={String(overview.scheduled_appointments)} to="/admin/appointments?status=scheduled" />
          <OverviewCard label="Citas completadas" value={String(overview.completed_appointments)} to="/admin/appointments?status=completed" />
          <OverviewCard label="Videoconsultas activas" value={String(overview.active_video_sessions)} onClick={() => scrollTo('videoconsultas')} />
          <OverviewCard label="Videoconsultas fallidas" value={String(overview.failed_video_sessions)} onClick={() => scrollTo('incidentes')} />
          <OverviewCard label="Citas no asistidas" value={String(overview.no_show_appointments)} to="/admin/appointments?status=no_show" />
          <OverviewCard label="Postulaciones pendientes" value={String(overview.pending_applications)} to="/admin/doctor-applications" />
          <OverviewCard label="Notificaciones sin leer" value={String(overview.unread_notifications)} to="/admin/notifications" />
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section id="videoconsultas" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Videoconsultas en curso</h2>
          <div className="mt-4 space-y-3">
            {liveSessions.length === 0 ? (
              <EmptyState icon={Activity} title="Sin videoconsultas" description="No hay videoconsultas preparadas o activas." />
            ) : (
              liveSessions.map((session) => (
                <div key={session.video_session_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{session.doctor_name}</p>
                    <Badge tone={VIDEO_SESSION_STATUS_TONES[session.status] ?? 'neutral'}>
                      {VIDEO_SESSION_STATUS_LABELS[session.status] || session.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {session.patient_name || session.patient_email}
                    {session.patient_name && <span className="text-slate-500"> · {session.patient_email}</span>}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section id="incidentes" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Incidentes recientes</h2>
          <div className="mt-4 space-y-3">
            {incidents.length === 0 ? (
              <EmptyState icon={Activity} title="Sin incidentes" description="No hay incidentes recientes que revisar." />
            ) : (
              incidents.map((incident) => (
                <div
                  key={`${incident.type}-${incident.entity_id}-${incident.created_at}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-sm font-semibold text-slate-900">{incident.title}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {INCIDENT_TYPE_LABELS[incident.type] || incident.type} ·{' '}
                    {new Date(incident.created_at).toLocaleString('es-ES')}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {!loading && !overview && (
        <Alert tone="danger" title="No se pudo cargar el panel">
          Vuelve a intentarlo en unos segundos.
        </Alert>
      )}
    </div>
  )
}

interface OverviewCardProps {
  label: string
  value: string
  to?: string
  onClick?: () => void
}

function OverviewCard({ label, value, to, onClick }: OverviewCardProps) {
  const inner = (
    <>
      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
      <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-700 opacity-0 transition-opacity group-hover:opacity-100">
        Ver detalle
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </>
  )

  const baseClass =
    'group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500'

  if (to) {
    return (
      <Link to={to} className={baseClass}>
        {inner}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${baseClass} text-left`}>
        {inner}
      </button>
    )
  }
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{inner}</div>
}
