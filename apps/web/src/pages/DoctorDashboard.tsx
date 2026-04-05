import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CalendarClock, FileText, Loader2, UserRoundX, Video } from 'lucide-react'

import {
  Appointment,
  DoctorDashboardResponse,
  getDoctorDashboard,
  markAppointmentNoShow,
  prepareAppointmentVideoSession,
} from '../api/appointments'
import { getMyNotifications, NotificationItem } from '../api/notifications'
import StructuredIntakeCard from '../components/StructuredIntakeCard'

export default function DoctorDashboard() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState<DoctorDashboardResponse | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joiningId, setJoiningId] = useState<number | null>(null)
  const [noShowId, setNoShowId] = useState<number | null>(null)

  const loadDashboard = async () => {
    try {
      setError(null)
      const [dashboardResponse, notificationsResponse] = await Promise.all([
        getDoctorDashboard(),
        getMyNotifications(),
      ])
      setDashboard(dashboardResponse)
      setNotifications(notificationsResponse.notifications.slice(0, 5))
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'No se pudo cargar el panel médico.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const getRoomAvailability = (appointment: Appointment) => {
    if (appointment.status !== 'scheduled') {
      return { enabled: false, label: 'Sala no disponible' }
    }

    const now = Date.now()
    const scheduledAt = new Date(appointment.scheduled_at).getTime()
    const openAt = scheduledAt - 60 * 60 * 1000
    const closeAt = scheduledAt + (appointment.duration_minutes + 180) * 60 * 1000

    if (now < openAt) {
      return { enabled: false, label: 'Disponible 60 min antes' }
    }
    if (now > closeAt) {
      return { enabled: false, label: 'Ventana cerrada' }
    }
    return { enabled: true, label: 'Entrar a la sala' }
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
        })
      )
      navigate('/video-room')
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

  const handleMarkNoShow = async (appointment: Appointment) => {
    const reason = window.prompt('Motivo del no-show (opcional):') || undefined
    setNoShowId(appointment.id)
    try {
      const updated = await markAppointmentNoShow(appointment.id, { reason })
      setDashboard((current) =>
        current
          ? {
              ...current,
              upcoming_appointments: current.upcoming_appointments.map((item) => (item.id === updated.id ? updated : item)),
            }
          : current
      )
    } finally {
      setNoShowId(null)
    }
  }

  if (loading || !dashboard) {
    if (!loading && error) {
      return (
        <div className="rounded-[32px] border border-rose-200 bg-rose-50 p-8 text-rose-800">
          <p className="text-lg font-semibold">No se pudo cargar el panel</p>
          <p className="mt-2 text-sm">{error}</p>
          <button
            onClick={() => {
              setLoading(true)
              loadDashboard()
            }}
            className="mt-4 rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-800"
          >
            Reintentar
          </button>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center py-20 text-stone-500">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Cargando panel médico...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-emerald-700">Panel clínico</p>
        <h1 className="mt-2 text-3xl font-bold text-stone-950">Resumen operativo</h1>
        <p className="mt-2 text-stone-600">Agenda próxima, briefs IA, reseñas recientes y notificaciones para tu práctica digital.</p>
        {error && <p className="mt-4 text-sm text-amber-700">{error}</p>}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboard.metrics.map((metric) => (
            <div key={metric.key} className="rounded-3xl bg-stone-100 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">{metric.label}</p>
              <p className="mt-3 text-3xl font-bold text-stone-950">{metric.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-emerald-700" />
            <h2 className="text-xl font-semibold text-stone-950">Próximas citas</h2>
          </div>
          <div className="mt-6 space-y-4">
            {dashboard.upcoming_appointments.length === 0 ? (
              <p className="text-sm text-stone-500">No tienes citas próximas.</p>
            ) : (
              dashboard.upcoming_appointments.map((appointment) => (
                <div key={appointment.id} className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-stone-950">{appointment.specialty_name}</p>
                      <p className="mt-1 text-sm text-stone-600">{appointment.patient_email}</p>
                      <p className="mt-2 text-sm text-stone-500">{new Date(appointment.scheduled_at).toLocaleString('es-ES')}</p>
                    </div>
                    <span className="rounded-full bg-stone-950 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white">
                      {appointment.status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => openAppointmentRoom(appointment)}
                      disabled={!getRoomAvailability(appointment).enabled || joiningId === appointment.id}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {joiningId === appointment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                      {joiningId === appointment.id ? 'Preparando sala...' : getRoomAvailability(appointment).label}
                    </button>
                    <button
                      onClick={() => navigate(`/doctor/patients/${appointment.patient_id}`)}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-white"
                    >
                      <FileText className="h-4 w-4" />
                      Ver historial
                    </button>
                    {canMarkNoShow(appointment) && (
                      <button
                        onClick={() => handleMarkNoShow(appointment)}
                        disabled={noShowId === appointment.id}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
                      >
                        {noShowId === appointment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundX className="h-4 w-4" />}
                        Marcar no-show
                      </button>
                    )}
                  </div>
                  {appointment.ai_summary_snapshot && (
                    <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
                      <p className="mb-2 text-xs uppercase tracking-[0.22em] text-blue-700">Brief IA</p>
                      <p className="whitespace-pre-wrap">{appointment.ai_summary_snapshot}</p>
                    </div>
                  )}
                  {appointment.ai_intake_snapshot && (
                    <StructuredIntakeCard
                      intake={appointment.ai_intake_snapshot}
                      title="Ficha previa estructurada"
                      className="mt-4"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-amber-700" />
            <h2 className="text-xl font-semibold text-stone-950">Notificaciones recientes</h2>
          </div>
          <div className="mt-6 space-y-4">
            {notifications.length === 0 ? (
              <p className="text-sm text-stone-500">No hay notificaciones pendientes.</p>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-sm font-semibold text-stone-900">{notification.title}</p>
                  <p className="mt-2 text-sm text-stone-600">{notification.body}</p>
                  {notification.action_url && (
                    <button
                      onClick={() => navigate(notification.action_url || '/notifications')}
                      className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-900"
                    >
                      {notification.action_label || 'Abrir'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <Video className="h-5 w-5 text-sky-700" />
          <h2 className="text-xl font-semibold text-stone-950">Sesiones activas y preparadas</h2>
        </div>
        <div className="mt-6 space-y-4">
          {dashboard.active_video_sessions.length === 0 ? (
            <p className="text-sm text-stone-500">No hay sesiones de video activas o preparadas.</p>
          ) : (
            dashboard.active_video_sessions.map((session) => (
              <div key={session.video_session_id} className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-stone-950">{session.patient_email}</p>
                    <p className="mt-1 text-sm text-stone-600">Estado: {session.status}</p>
                  </div>
                  <button
                    onClick={() =>
                      navigate(
                        session.appointment_id ? '/doctor' : '/doctor/video-sessions'
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-800"
                  >
                    <Video className="h-4 w-4" />
                    Revisar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
