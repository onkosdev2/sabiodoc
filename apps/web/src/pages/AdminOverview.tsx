import { useCallback, useEffect, useState } from 'react'
import { RefreshCcw } from 'lucide-react'

import {
  AdminIncident,
  AdminLiveVideoSession,
  getAdminIncidents,
  getLiveVideoSessions,
  getMarketplaceOverview,
  MarketplaceOverview,
} from '../api/admin'

export default function AdminOverview() {
  const [overview, setOverview] = useState<MarketplaceOverview | null>(null)
  const [liveSessions, setLiveSessions] = useState<AdminLiveVideoSession[]>([])
  const [incidents, setIncidents] = useState<AdminIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [overviewResponse, liveSessionsResponse, incidentsResponse] = await Promise.all([
        getMarketplaceOverview(),
        getLiveVideoSessions(),
        getAdminIncidents(),
      ])
      setOverview(overviewResponse)
      setLiveSessions(liveSessionsResponse.sessions)
      setIncidents(incidentsResponse.incidents)
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { detail?: string } } }
      setError(requestError.response?.data?.detail || 'No se pudo cargar el panel operativo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sky-700">Admin</p>
            <h1 className="mt-2 text-3xl font-bold text-stone-950">Panel operativo</h1>
            <p className="mt-2 max-w-3xl text-stone-600">
              Resumen del marketplace, videoconsultas en curso e incidentes recientes.
            </p>
          </div>
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:border-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Recargando...' : 'Recargar'}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {overview && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <OverviewCard label="Médicos online" value={String(overview.doctors_online)} />
          <OverviewCard label="Médicos ocupados" value={String(overview.doctors_busy)} />
          <OverviewCard label="Citas programadas" value={String(overview.scheduled_appointments)} />
          <OverviewCard label="Consultas completadas" value={String(overview.completed_appointments)} />
          <OverviewCard label="Video activas" value={String(overview.active_video_sessions)} />
          <OverviewCard label="Fallos/expiradas" value={String(overview.failed_video_sessions)} />
          <OverviewCard label="No-show" value={String(overview.no_show_appointments)} />
          <OverviewCard label="Pendientes de aprobación" value={String(overview.pending_applications)} />
          <OverviewCard label="Notificaciones sin leer" value={String(overview.unread_notifications)} />
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-950">Videoconsultas en curso</h2>
          <div className="mt-4 space-y-3">
            {liveSessions.length === 0 ? (
              <p className="text-sm text-stone-500">No hay sesiones preparadas o activas.</p>
            ) : (
              liveSessions.map((session) => (
                <div key={session.video_session_id} className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-sm font-semibold text-stone-900">{session.doctor_name}</p>
                  <p className="mt-1 text-sm text-stone-600">{session.patient_email}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500">{session.status}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-950">Incidentes recientes</h2>
          <div className="mt-4 space-y-3">
            {incidents.length === 0 ? (
              <p className="text-sm text-stone-500">No hay incidentes recientes.</p>
            ) : (
              incidents.map((incident) => (
                <div
                  key={`${incident.type}-${incident.entity_id}-${incident.created_at}`}
                  className="rounded-3xl border border-stone-200 bg-stone-50 p-4"
                >
                  <p className="text-sm font-semibold text-stone-900">{incident.title}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500">
                    {incident.type} · {new Date(incident.created_at).toLocaleString('es-ES')}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function OverviewCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-stone-950">{value}</p>
    </div>
  )
}
