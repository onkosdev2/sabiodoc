import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, ChevronRight, FileText, UserRoundX, Video } from 'lucide-react'

import {
  Appointment,
  DoctorDashboardResponse,
  getDoctorDashboard,
  markAppointmentNoShow,
  prepareAppointmentVideoSession,
} from '../api/appointments'
import { useToast } from '../context/ToastContext'
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES, VIDEO_SESSION_STATUS_LABELS } from '../utils/statusLabels'
import { getRoomAvailability } from '../utils/appointmentRoom'
import { getApiErrorMessage } from '../utils/apiError'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import { Textarea } from '../components/ui/Field'
import RichText from '../components/RichText'
import StructuredIntakeCard from '../components/StructuredIntakeCard'
import SummaryToggleButton from '../components/SummaryToggleButton'

// Cada tarjeta del dashboard lleva al detalle real correspondiente.
const METRIC_DESTINATIONS: Record<string, string> = {
  scheduled: '/doctor/appointments?status=scheduled',
  completed: '/doctor/appointments?status=completed',
  rating: '/doctor/reviews',
  notifications: '/doctor/notifications',
}

export default function DoctorDashboard() {
  const navigate = useNavigate()
  const toast = useToast()
  const [dashboard, setDashboard] = useState<DoctorDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joiningId, setJoiningId] = useState<number | null>(null)
  const [noShowTarget, setNoShowTarget] = useState<Appointment | null>(null)
  const [noShowReason, setNoShowReason] = useState('')
  const [noShowBusy, setNoShowBusy] = useState(false)
  const [expandedAppointments, setExpandedAppointments] = useState<Set<number>>(new Set())

  const loadDashboard = async () => {
    try {
      setError(null)
      const dashboardResponse = await getDoctorDashboard()
      setDashboard(dashboardResponse)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No se pudo cargar el panel médico.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

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
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, 'No se pudo preparar la sala.'))
    } finally {
      setJoiningId(null)
    }
  }

  const canMarkNoShow = (appointment: Appointment) => {
    if (appointment.status !== 'scheduled') {
      return false
    }
    const graceLimit = new Date(appointment.scheduled_at).getTime() + 10 * 60 * 1000
    return Date.now() >= graceLimit && !appointment.joined_patient_at
  }

  const toggleAppointmentDetails = (appointmentId: number) => {
    setExpandedAppointments((current) => {
      const next = new Set(current)
      if (next.has(appointmentId)) {
        next.delete(appointmentId)
      } else {
        next.add(appointmentId)
      }
      return next
    })
  }

  const confirmNoShow = async () => {
    if (!noShowTarget) return
    setNoShowBusy(true)
    try {
      const updated = await markAppointmentNoShow(noShowTarget.id, { reason: noShowReason.trim() || undefined })
      setDashboard((current) =>
        current
          ? {
              ...current,
              upcoming_appointments: current.upcoming_appointments.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : current,
      )
      toast.success('Cita marcada como no asistida.')
      setNoShowTarget(null)
      setNoShowReason('')
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, 'No se pudo marcar el no-show.'))
    } finally {
      setNoShowBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="space-y-4">
        <Alert tone="danger" title="No se pudo cargar el panel">
          {error}
        </Alert>
        <Button
          variant="secondary"
          onClick={() => {
            setLoading(true)
            loadDashboard()
          }}
        >
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel operativo"
        description="Agenda próxima, resúmenes de pre-consulta, reseñas recientes y notificaciones para tu práctica digital."
      />

      {error && <Alert tone="warning">{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <Link
            key={metric.key}
            to={METRIC_DESTINATIONS[metric.key] || '/doctor'}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">{metric.value}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 opacity-0 transition-opacity group-hover:opacity-100">
              Ver detalle
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-slate-950">Próximas citas</h2>
          </div>
          <div className="mt-6 space-y-4">
            {dashboard.upcoming_appointments.length === 0 ? (
              <EmptyState icon={CalendarClock} title="No tienes citas próximas" description="Cuando agenden contigo, aparecerán aquí." />
            ) : (
              dashboard.upcoming_appointments.map((appointment) => (
                <div key={appointment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{appointment.specialty_name}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {appointment.patient_name || appointment.patient_email}
                        {appointment.patient_name && (
                          <span className="text-slate-500"> · {appointment.patient_email}</span>
                        )}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        {new Date(appointment.scheduled_at).toLocaleString('es-ES')}
                      </p>
                    </div>
                    <Badge tone={APPOINTMENT_STATUS_TONES[appointment.status]}>
                      {APPOINTMENT_STATUS_LABELS[appointment.status]}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      onClick={() => openAppointmentRoom(appointment)}
                      disabled={!getRoomAvailability(appointment).enabled}
                      loading={joiningId === appointment.id}
                      leftIcon={<Video className="h-4 w-4" />}
                    >
                      {joiningId === appointment.id ? 'Preparando sala...' : getRoomAvailability(appointment).label}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/doctor/patients/${appointment.patient_id}`)}
                      leftIcon={<FileText className="h-4 w-4" />}
                    >
                      Ver historial
                    </Button>
                    {canMarkNoShow(appointment) && (
                      <Button
                        variant="secondary"
                        onClick={() => setNoShowTarget(appointment)}
                        leftIcon={<UserRoundX className="h-4 w-4" />}
                        className="text-rose-700 hover:bg-rose-50"
                      >
                        Marcar no-show
                      </Button>
                    )}
                  </div>
                  {(() => {
                    const hasPreConsultation = Boolean(
                      appointment.ai_summary_snapshot || appointment.ai_intake_snapshot,
                    )
                    if (!hasPreConsultation) return null
                    const isExpanded = expandedAppointments.has(appointment.id)
                    const chiefComplaint = appointment.ai_intake_snapshot?.chief_complaint

                    return (
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="line-clamp-2 text-sm text-slate-600">
                            {chiefComplaint ? (
                              <>
                                <span className="font-medium text-slate-700">Motivo: </span>
                                {chiefComplaint}
                              </>
                            ) : (
                              'Pre-consulta IA disponible'
                            )}
                          </p>
                          <SummaryToggleButton
                            expanded={isExpanded}
                            onClick={() => toggleAppointmentDetails(appointment.id)}
                            size="sm"
                            className="shrink-0"
                          />
                        </div>

                        {isExpanded && (
                          <div className="mt-4 space-y-4">
                            {appointment.ai_summary_snapshot && (
                              <div className="rounded-2xl bg-primary-50 p-4 text-sm text-primary-900">
                                <p className="mb-2 text-xs uppercase tracking-[0.22em] text-primary-700">
                                  Resumen para el médico
                                </p>
                                <RichText text={appointment.ai_summary_snapshot} />
                              </div>
                            )}
                            {appointment.ai_intake_snapshot && (
                              <StructuredIntakeCard
                                intake={appointment.ai_intake_snapshot}
                                title="Ficha clínica estructurada"
                                description="Datos clave de la pre-consulta para revisar antes de la cita."
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Video className="h-5 w-5 text-sky-700" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-slate-950">Sesiones activas y preparadas</h2>
          </div>
          <div className="mt-6 space-y-4">
            {dashboard.active_video_sessions.length === 0 ? (
              <EmptyState icon={Video} title="Sin sesiones activas" description="No hay videoconsultas activas o preparadas." />
            ) : (
              dashboard.active_video_sessions.map((session) => (
                <div key={session.video_session_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">
                        {session.patient_name || session.patient_email}
                      </p>
                      {session.patient_name && <p className="text-sm text-slate-500">{session.patient_email}</p>}
                      <p className="mt-1 text-sm text-slate-600">
                        Estado: {VIDEO_SESSION_STATUS_LABELS[session.status] || session.status}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => navigate('/doctor/video-sessions')}
                      leftIcon={<Video className="h-4 w-4" />}
                    >
                      Revisar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <Modal
        open={noShowTarget !== null}
        onClose={() => !noShowBusy && setNoShowTarget(null)}
        title="Marcar como no asistida"
        description={noShowTarget ? `${noShowTarget.specialty_name} · ${noShowTarget.patient_email}` : undefined}
        icon={
          <span className="inline-flex rounded-full bg-red-100 p-2 text-red-600">
            <UserRoundX className="h-5 w-5" aria-hidden="true" />
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoShowTarget(null)} disabled={noShowBusy}>
              Volver
            </Button>
            <Button variant="danger" loading={noShowBusy} onClick={confirmNoShow}>
              Marcar no-show
            </Button>
          </>
        }
      >
        <Textarea
          label="Motivo (opcional)"
          value={noShowReason}
          onChange={(event) => setNoShowReason(event.target.value)}
          placeholder="Notas internas sobre la inasistencia."
          className="min-h-20"
        />
      </Modal>
    </div>
  )
}
