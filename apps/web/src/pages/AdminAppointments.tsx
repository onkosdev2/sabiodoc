import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, RefreshCcw } from 'lucide-react'

import { Appointment, AppointmentStatus } from '../api/appointments'
import { getAdminAppointments } from '../api/admin'
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from '../utils/statusLabels'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'

type FilterValue = 'all' | AppointmentStatus

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'scheduled', label: 'Programadas' },
  { value: 'completed', label: 'Completadas' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'no_show', label: 'No asistió' },
]

const STATUS_VALUES: FilterValue[] = ['all', 'scheduled', 'completed', 'cancelled', 'no_show']

export default function AdminAppointments() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFilter = (searchParams.get('status') as FilterValue) || 'all'
  const [filter, setFilter] = useState<FilterValue>(STATUS_VALUES.includes(initialFilter) ? initialFilter : 'all')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  const loadAppointments = useCallback(
    async (nextFilter: FilterValue) => {
      setLoading(true)
      try {
        const response = await getAdminAppointments(nextFilter === 'all' ? undefined : nextFilter)
        setAppointments(response.appointments)
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudieron cargar las citas.'))
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    loadAppointments(filter)
  }, [filter, loadAppointments])

  const changeFilter = (nextFilter: FilterValue) => {
    setFilter(nextFilter)
    setSearchParams(nextFilter === 'all' ? {} : { status: nextFilter })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Citas"
        description="Todas las citas del marketplace con su estado y participantes."
        actions={
          <Button
            variant="secondary"
            onClick={() => loadAppointments(filter)}
            disabled={loading}
            leftIcon={<RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Recargar
          </Button>
        }
      />

      <div role="tablist" aria-label="Filtrar citas" className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {FILTERS.map((option) => {
          const selected = filter === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => changeFilter(option.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                selected ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Sin citas para este filtro" description="Cambia el filtro para ver otras citas." />
      ) : (
        <div className="space-y-4">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold text-slate-950">{appointment.specialty_name}</h2>
                    <Badge tone={APPOINTMENT_STATUS_TONES[appointment.status]}>
                      {APPOINTMENT_STATUS_LABELS[appointment.status]}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <p>
                      Paciente:{' '}
                      <span className="font-medium text-slate-800">
                        {appointment.patient_name || appointment.patient_email}
                      </span>
                      {appointment.patient_name && <span className="text-slate-500"> · {appointment.patient_email}</span>}
                    </p>
                    <p>Médico: {appointment.doctor_name}</p>
                    <p className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-sky-700" aria-hidden="true" />
                      {new Date(appointment.scheduled_at).toLocaleString('es-ES')} · {appointment.duration_minutes} min
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
