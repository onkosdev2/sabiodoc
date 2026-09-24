import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, FileText, RefreshCcw, Video } from 'lucide-react'

import {
  Appointment,
  AppointmentStatus,
  getMyDoctorAppointments,
  prepareAppointmentVideoSession,
} from '../api/appointments'
import { useToast } from '../context/ToastContext'
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from '../utils/statusLabels'
import { getRoomAvailability } from '../utils/appointmentRoom'
import { getApiErrorMessage } from '../utils/apiError'
import BackButton from '../components/BackButton'
import AppointmentFilesPanel from '../components/AppointmentFilesPanel'
import type { VideoSessionFile } from '../api/videoSessions'
import Pagination from '../components/Pagination'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import { usePagination } from '../hooks/usePagination'

type FilterValue = 'all' | AppointmentStatus

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'scheduled', label: 'Programadas' },
  { value: 'completed', label: 'Completadas' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'no_show', label: 'No asistió' },
]

const STATUS_VALUES: FilterValue[] = ['all', 'scheduled', 'completed', 'cancelled', 'no_show']

export default function DoctorAppointments() {
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFilter = (searchParams.get('status') as FilterValue) || 'all'
  const [filter, setFilter] = useState<FilterValue>(STATUS_VALUES.includes(initialFilter) ? initialFilter : 'all')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [joiningId, setJoiningId] = useState<number | null>(null)
  const { page, setPage, pageItems, totalPages, totalItems, pageSize } = usePagination(appointments, 8, filter)

  const loadAppointments = useCallback(
    async (nextFilter: FilterValue) => {
      setLoading(true)
      try {
        const response = await getMyDoctorAppointments(nextFilter === 'all' ? undefined : nextFilter)
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

  const openAppointmentRoom = async (appointment: Appointment) => {
    setJoiningId(appointment.id)
    try {
      const session = await prepareAppointmentVideoSession(appointment.id)
      sessionStorage.setItem(
        'sabiodoc-video-session',
        JSON.stringify({
          video_session_id: session.video_session_id,
          appointment_id: session.appointment_id,
          consultation_id: session.consultation_id,
          specialty_name: session.specialty_name,
          doctor_name: session.doctor_name,
          provider: session.provider,
          room_url: session.room_url,
          participant_token: session.participant_token,
          participant_role: session.participant_role,
          prepaid_amount_cents: 0,
          estimated_minutes: appointment.duration_minutes,
          expires_at: session.expires_at,
        }),
      )
      navigate('/video-room')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo preparar la sala.'))
    } finally {
      setJoiningId(null)
    }
  }

  const handleAppointmentFilesChange = (
    appointmentId: number,
    files: VideoSessionFile[],
  ) => {
    setAppointments((current) =>
      current.map((item) => (item.id === appointmentId ? { ...item, files } : item)),
    )
  }

  return (
    <div className="space-y-6">
      <BackButton />

      <PageHeader
        title="Citas"
        description="Todas tus citas con su estado, paciente y acceso a la sala."
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
            <Skeleton key={index} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Sin citas para este filtro"
          description="Cambia el filtro o espera nuevas reservas de tus pacientes."
        />
      ) : (
        <div className="space-y-4">
          {pageItems.map((appointment) => {
            const room = getRoomAvailability(appointment)
            return (
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
                      <p className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                        {new Date(appointment.scheduled_at).toLocaleString('es-ES')} · {appointment.duration_minutes} min
                      </p>
                    </div>
                    {appointment.patient_note && (
                      <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{appointment.patient_note}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 md:min-w-[200px]">
                    {appointment.status === 'scheduled' && (
                      <Button
                        onClick={() => openAppointmentRoom(appointment)}
                        disabled={!room.enabled}
                        loading={joiningId === appointment.id}
                        leftIcon={<Video className="h-4 w-4" />}
                      >
                        {joiningId === appointment.id ? 'Preparando sala...' : room.label}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/doctor/patients/${appointment.patient_id}`)}
                      leftIcon={<FileText className="h-4 w-4" />}
                    >
                      Ver historial
                    </Button>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <AppointmentFilesPanel
                    appointmentId={appointment.id}
                    files={appointment.files}
                    enabled={appointment.files_enabled}
                    role="doctor"
                    onFilesChange={(files) => handleAppointmentFilesChange(appointment.id, files)}
                  />
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
