import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, FileText, RefreshCcw, Search, Star, Users, Video } from 'lucide-react'

import { DoctorPatientSummary, getMyPatients } from '../api/doctors'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import { formatRelativeTime } from '../utils/relativeTime'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'

export default function DoctorPatients() {
  const toast = useToast()
  const [patients, setPatients] = useState<DoctorPatientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadPatients = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getMyPatients()
      setPatients(response.patients)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar tus pacientes.'))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadPatients()
  }, [loadPatients])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return patients
    return patients.filter(
      (patient) =>
        (patient.full_name || '').toLowerCase().includes(term) || patient.email.toLowerCase().includes(term),
    )
  }, [patients, search])

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Mis pacientes"
        description="Pacientes con los que has trabajado. Entra a su historial clínico completo."
        actions={
          <Button
            variant="secondary"
            onClick={loadPatients}
            disabled={loading}
            leftIcon={<RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Recargar
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Buscar paciente por nombre o correo"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o correo..."
          className="input-field pl-11"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={patients.length === 0 ? 'Aún no tienes pacientes' : 'Sin coincidencias'}
          description={
            patients.length === 0
              ? 'Cuando atiendas citas o videoconsultas, tus pacientes aparecerán aquí.'
              : 'Prueba con otro nombre o correo.'
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((patient) => (
            <article key={patient.patient_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-slate-950">
                    {patient.full_name || patient.email}
                  </h2>
                  {patient.full_name && <p className="truncate text-sm text-slate-500">{patient.email}</p>}
                </div>
                {patient.last_review_rating != null && (
                  <Badge tone="warning" icon={<Star className="h-3.5 w-3.5" aria-hidden="true" />}>
                    {patient.last_review_rating}/5
                  </Badge>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="info" icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />}>
                  {patient.appointments_count} {patient.appointments_count === 1 ? 'cita' : 'citas'}
                </Badge>
                {patient.completed_appointments > 0 && (
                  <Badge tone="success">
                    {patient.completed_appointments} completada{patient.completed_appointments === 1 ? '' : 's'}
                  </Badge>
                )}
                {patient.upcoming_appointments > 0 && (
                  <Badge tone="primary">
                    {patient.upcoming_appointments} próxima{patient.upcoming_appointments === 1 ? '' : 's'}
                  </Badge>
                )}
                {patient.video_sessions_count > 0 && (
                  <Badge tone="neutral" icon={<Video className="h-3.5 w-3.5" aria-hidden="true" />}>
                    {patient.video_sessions_count} video
                  </Badge>
                )}
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Última actividad: {patient.last_activity_at ? formatRelativeTime(patient.last_activity_at) : 'sin registro'}
              </p>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <Link
                  to={`/doctor/patients/${patient.patient_id}`}
                  className="btn-secondary inline-flex w-full items-center justify-center gap-2"
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Ver historial clínico
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
