import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, CalendarPlus, RefreshCcw, Star, Video, XCircle } from 'lucide-react'

import {
  Appointment,
  cancelAppointmentWithReason,
  getMyAppointments,
  prepareAppointmentVideoSession,
  reviewAppointment,
} from '../api/appointments'
import { useToast } from '../context/ToastContext'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/Pagination'
import Skeleton from '../components/ui/Skeleton'
import { Textarea } from '../components/ui/Field'
import RichText from '../components/RichText'
import StructuredIntakeCard from '../components/StructuredIntakeCard'
import SummaryToggleButton from '../components/SummaryToggleButton'
import AppointmentFilesPanel from '../components/AppointmentFilesPanel'
import type { VideoSessionFile } from '../api/videoSessions'
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from '../utils/statusLabels'
import { getApiErrorMessage } from '../utils/apiError'
import { formatMoney } from '../utils/format'
import { usePagination } from '../hooks/usePagination'

/** Vista previa en texto plano de un resumen con Markdown, para las tarjetas colapsadas. */
function summaryPreview(summary: string, maxLength = 160): string {
  const plain = summary
    .replace(/[#*_>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > maxLength ? `${plain.slice(0, maxLength).trimEnd()}…` : plain
}

export default function MyAppointments() {
  const navigate = useNavigate()
  const toast = useToast()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, { rating: number; comment: string }>>({})
  const [joiningId, setJoiningId] = useState<number | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [expandedAppointments, setExpandedAppointments] = useState<Set<number>>(new Set())
  const { page, setPage, pageItems, totalPages, totalItems, pageSize } = usePagination(appointments, 8)

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        const response = await getMyAppointments()
        setAppointments(response.appointments)
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudieron cargar tus citas.'))
      } finally {
        setLoading(false)
      }
    }
    loadAppointments()
  }, [toast])

  const updateReviewDraft = (appointmentId: number, patch: Partial<{ rating: number; comment: string }>) => {
    setReviewDrafts((current) => {
      const existing = current[appointmentId]
      return {
        ...current,
        [appointmentId]: {
          rating: patch.rating ?? existing?.rating ?? 0,
          comment: patch.comment ?? existing?.comment ?? '',
        },
      }
    })
  }

  const handleReview = async (appointmentId: number) => {
    const draft = reviewDrafts[appointmentId]
    if (!draft || !draft.rating) return
    setReviewingId(appointmentId)
    try {
      const updated = await reviewAppointment(appointmentId, {
        rating: draft.rating,
        comment: draft.comment.trim() || undefined,
      })
      setAppointments((current) => current.map((item) => (item.id === appointmentId ? updated : item)))
      setReviewDrafts((current) => {
        const next = { ...current }
        delete next[appointmentId]
        return next
      })
      toast.success('¡Gracias! Tu valoración quedó registrada.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo enviar la reseña.'))
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
        }),
      )
      navigate('/video-room')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo preparar la sala.'))
    } finally {
      setJoiningId(null)
    }
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

  const handleAppointmentFilesChange = (
    appointmentId: number,
    files: VideoSessionFile[],
  ) => {
    setAppointments((current) =>
      current.map((item) => (item.id === appointmentId ? { ...item, files } : item)),
    )
  }

  const confirmCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      const updated = await cancelAppointmentWithReason(cancelTarget.id, {
        reason: cancelReason.trim() || undefined,
      })
      setAppointments((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      toast.success('Cita cancelada.')
      setCancelTarget(null)
      setCancelReason('')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cancelar la cita.'))
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarDays}
        title="Mis citas"
        description="Revisa tus citas programadas, resúmenes IA y seguimiento postconsulta."
      />

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Todavía no tienes citas"
          description="Cuando agendes una videoconsulta, aparecerá aquí con su resumen y seguimiento."
          action={
            <Link to="/specialties" className="btn-primary">
              <CalendarPlus className="h-4 w-4" />
              Agendar una cita
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {pageItems.map((appointment) => {
            const roomAvailability = getRoomAvailability(appointment)
            const hasPreConsultation = Boolean(
              appointment.ai_summary_snapshot || appointment.ai_intake_snapshot,
            )
            const isExpanded = expandedAppointments.has(appointment.id)
            const preview = appointment.ai_intake_snapshot?.chief_complaint
              ? appointment.ai_intake_snapshot.chief_complaint
              : appointment.ai_summary_snapshot
                ? summaryPreview(appointment.ai_summary_snapshot)
                : null

            return (
              <Card key={appointment.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{appointment.specialty_name}</h2>
                    <p className="mt-1 text-sm text-slate-600">Con {appointment.doctor_name}</p>
                    <p className="mt-2 text-sm text-slate-500">
                      {new Date(appointment.scheduled_at).toLocaleString('es-ES')} · {appointment.duration_minutes} min
                    </p>
                  </div>
                  <Badge tone={APPOINTMENT_STATUS_TONES[appointment.status]}>
                    {APPOINTMENT_STATUS_LABELS[appointment.status]}
                  </Badge>
                </div>

                {appointment.status === 'scheduled' && (
                  <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-sky-700">Videoconsulta programada</p>
                    <p className="mt-2 text-sm text-sky-900">{roomAvailability.note}</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button
                        onClick={() => handleJoinRoom(appointment)}
                        disabled={!roomAvailability.enabled}
                        loading={joiningId === appointment.id}
                        leftIcon={<Video className="h-4 w-4" />}
                      >
                        {joiningId === appointment.id ? 'Preparando sala...' : roomAvailability.label}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => navigate(`/me/appointments/${appointment.id}/reschedule`)}
                        leftIcon={<RefreshCcw className="h-4 w-4" />}
                      >
                        Reprogramar
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setCancelTarget(appointment)}
                        leftIcon={<XCircle className="h-4 w-4" />}
                        className="text-rose-700 hover:bg-rose-50"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                {appointment.payment_amount_cents != null && (
                  <p className="mt-3 text-sm text-slate-600">
                    <span className="font-medium text-slate-800">
                      {appointment.payment_status === 'refunded'
                        ? 'Reembolsado'
                        : appointment.payment_status === 'released'
                          ? 'Pagado al médico'
                          : 'Pago retenido'}
                      :
                    </span>{' '}
                    {formatMoney(appointment.payment_amount_cents)}
                  </p>
                )}

                {appointment.cancellation_reason && (
                  <div className="mt-4 rounded-2xl bg-rose-50 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-rose-700">Motivo registrado</p>
                    <p className="mt-2 text-sm text-rose-900">{appointment.cancellation_reason}</p>
                  </div>
                )}

                {hasPreConsultation && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {preview && <p className="line-clamp-2 text-sm text-slate-600">{preview}</p>}
                      <SummaryToggleButton
                        expanded={isExpanded}
                        onClick={() => toggleAppointmentDetails(appointment.id)}
                        className="shrink-0 self-start sm:self-auto"
                      />
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-4">
                        {appointment.ai_summary_snapshot && (
                          <div className="rounded-2xl bg-primary-50 p-4">
                            <p className="text-xs uppercase tracking-[0.22em] text-primary-700">
                              Resumen para el médico
                            </p>
                            <RichText
                              text={appointment.ai_summary_snapshot}
                              className="mt-2 text-sm text-primary-900"
                            />
                          </div>
                        )}

                        {appointment.ai_intake_snapshot && (
                          <StructuredIntakeCard
                            intake={appointment.ai_intake_snapshot}
                            title="Ficha clínica estructurada"
                            description="Datos clave de la pre-consulta que se comparten con el médico."
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <AppointmentFilesPanel
                    appointmentId={appointment.id}
                    files={appointment.files}
                    enabled={appointment.files_enabled}
                    role="patient"
                    onFilesChange={(files) => handleAppointmentFilesChange(appointment.id, files)}
                  />
                </div>

                {appointment.followup_instructions && (
                  <div className="mt-4 rounded-2xl bg-emerald-50 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">Indicaciones postconsulta</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900">
                      {appointment.followup_instructions}
                    </p>
                  </div>
                )}

                {appointment.status === 'completed' && !appointment.review_rating && (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-800">Deja tu reseña</p>

                    <div className="mt-2 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((rating) => {
                        const filled = (reviewDrafts[appointment.id]?.rating ?? 0) >= rating
                        return (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => updateReviewDraft(appointment.id, { rating })}
                            disabled={reviewingId === appointment.id}
                            aria-label={`${rating} de 5 estrellas`}
                            className="rounded-full p-1 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
                          >
                            <Star className={`h-6 w-6 ${filled ? 'fill-current text-amber-500' : 'text-amber-300'}`} />
                          </button>
                        )
                      })}
                    </div>

                    <Textarea
                      aria-label="Comentario de la reseña"
                      value={reviewDrafts[appointment.id]?.comment ?? ''}
                      onChange={(event) => updateReviewDraft(appointment.id, { comment: event.target.value })}
                      placeholder="Comentario (opcional)"
                      maxLength={1200}
                      className="mt-3 min-h-20"
                    />

                    <Button
                      onClick={() => handleReview(appointment.id)}
                      disabled={!reviewDrafts[appointment.id]?.rating}
                      loading={reviewingId === appointment.id}
                      leftIcon={<Star className="h-4 w-4" />}
                      className="mt-3"
                    >
                      Enviar reseña
                    </Button>
                  </div>
                )}

                {appointment.review_rating && (
                  <div className="mt-5">
                    <p className="text-sm font-medium text-amber-700">Reseña enviada: {appointment.review_rating}/5</p>
                    {appointment.review_comment && (
                      <p className="mt-1 text-sm text-slate-600">{appointment.review_comment}</p>
                    )}
                  </div>
                )}
              </Card>
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

      <Modal
        open={cancelTarget !== null}
        onClose={() => !cancelling && setCancelTarget(null)}
        title="¿Cancelar esta cita?"
        description={
          cancelTarget ? `${cancelTarget.specialty_name} con ${cancelTarget.doctor_name}` : undefined
        }
        icon={
          <span className="inline-flex rounded-full bg-red-100 p-2 text-red-600">
            <XCircle className="h-5 w-5" aria-hidden="true" />
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Volver
            </Button>
            <Button variant="danger" loading={cancelling} onClick={confirmCancel}>
              Cancelar cita
            </Button>
          </>
        }
      >
        <Textarea
          label="Motivo (opcional)"
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          placeholder="Cuéntanos brevemente por qué cancelas."
          className="min-h-20"
        />
      </Modal>
    </div>
  )
}
