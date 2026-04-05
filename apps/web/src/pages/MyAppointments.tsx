import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Loader2, RefreshCcw, Star, Video, XCircle } from 'lucide-react'

import {
  Appointment,
  cancelAppointmentWithReason,
  getMyAppointments,
  prepareAppointmentVideoSession,
  reviewAppointment,
} from '../api/appointments'
import StructuredIntakeCard from '../components/StructuredIntakeCard'

export default function MyAppointments() {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [joiningId, setJoiningId] = useState<number | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        const response = await getMyAppointments()
        setAppointments(response.appointments)
      } finally {
        setLoading(false)
      }
    }
    loadAppointments()
  }, [])

  const handleReview = async (appointmentId: number, rating: number) => {
    setReviewingId(appointmentId)
    try {
      const updated = await reviewAppointment(appointmentId, { rating, comment: 'Reseña rápida desde el panel del paciente.' })
      setAppointments((current) => current.map((item) => (item.id === appointmentId ? updated : item)))
    } finally {
      setReviewingId(null)
    }
  }

  const getRoomAvailability = (appointment: Appointment) => {
    if (appointment.status !== 'scheduled') {
      return { enabled: false, label: 'Sala no disponible', note: 'Solo las citas programadas pueden abrir sala.' }
    }

    const now = Date.now()
    const scheduledAt = new Date(appointment.scheduled_at).getTime()
    const openAt = scheduledAt - 60 * 60 * 1000
    const closeAt = scheduledAt + (appointment.duration_minutes + 180) * 60 * 1000

    if (now < openAt) {
      return { enabled: false, label: 'Disponible 60 min antes', note: 'La sala se habilita una hora antes de la cita.' }
    }
    if (now > closeAt) {
      return { enabled: false, label: 'Ventana cerrada', note: 'La ventana de acceso ya cerró.' }
    }
    return { enabled: true, label: 'Entrar a la sala', note: 'La sala ya está disponible para la cita agendada.' }
  }

  const handleJoinRoom = async (appointment: Appointment) => {
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

  const handleCancel = async (appointment: Appointment) => {
    const reason = window.prompt('Motivo de cancelación (opcional):') || undefined
    setCancellingId(appointment.id)
    try {
      const updated = await cancelAppointmentWithReason(appointment.id, { reason })
      setAppointments((current) => current.map((item) => (item.id === appointment.id ? updated : item)))
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mis citas</h1>
        <p className="mt-2 text-gray-600">Revisa tus citas programadas, resúmenes IA y seguimiento postconsulta.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Cargando citas...
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center text-gray-500">
          <CalendarDays className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          Todavía no tienes citas agendadas.
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appointment) => {
            const roomAvailability = getRoomAvailability(appointment)

            return (
              <div key={appointment.id} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{appointment.specialty_name}</h2>
                  <p className="mt-1 text-sm text-gray-600">Con {appointment.doctor_name}</p>
                  <p className="mt-2 text-sm text-gray-500">
                    {new Date(appointment.scheduled_at).toLocaleString('es-ES')} · {appointment.duration_minutes} min
                  </p>
                </div>
                <span className="rounded-full bg-gray-900 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white">
                  {appointment.status}
                </span>
              </div>

              {appointment.status === 'scheduled' && (
                <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-sky-700">Videoconsulta programada</p>
                      <p className="mt-2 text-sm text-sky-900">{roomAvailability.note}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleJoinRoom(appointment)}
                        disabled={!roomAvailability.enabled || joiningId === appointment.id}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {joiningId === appointment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                        {joiningId === appointment.id ? 'Preparando sala...' : roomAvailability.label}
                      </button>
                      <button
                        onClick={() => navigate(`/me/appointments/${appointment.id}/reschedule`)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-300 px-5 py-3 text-sm font-semibold text-sky-800 hover:bg-white"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Reprogramar
                      </button>
                      <button
                        onClick={() => handleCancel(appointment)}
                        disabled={cancellingId === appointment.id}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-300 px-5 py-3 text-sm font-semibold text-rose-700 hover:bg-white disabled:opacity-50"
                      >
                        {cancellingId === appointment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {appointment.cancellation_reason && (
                <div className="mt-4 rounded-2xl bg-rose-50 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-rose-700">Motivo registrado</p>
                  <p className="mt-2 text-sm text-rose-900">{appointment.cancellation_reason}</p>
                </div>
              )}

              {appointment.ai_summary_snapshot && (
                <div className="mt-5 rounded-2xl bg-blue-50 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-blue-700">Brief IA</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-blue-900">{appointment.ai_summary_snapshot}</p>
                </div>
              )}

              {appointment.ai_intake_snapshot && (
                <StructuredIntakeCard
                  intake={appointment.ai_intake_snapshot}
                  title="Ficha previa compartida con el médico"
                  className="mt-4"
                />
              )}

              {appointment.followup_instructions && (
                <div className="mt-4 rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">Indicaciones postconsulta</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900">{appointment.followup_instructions}</p>
                </div>
              )}

              {appointment.status === 'completed' && !appointment.review_rating && (
                <div className="mt-5 flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => handleReview(appointment.id, rating)}
                      disabled={reviewingId === appointment.id}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-300 text-amber-500 hover:bg-amber-50"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              )}

              {appointment.review_rating && (
                <p className="mt-5 text-sm font-medium text-amber-700">Reseña enviada: {appointment.review_rating}/5</p>
              )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
