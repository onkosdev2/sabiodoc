import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, AlertTriangle, ArrowLeft, Clock3, FileText, Loader2, Timer, Video, VideoOff } from 'lucide-react'

import {
  completeVideoSession,
  getVideoSessionStatus,
  joinVideoSession,
  updateVideoSessionDoctorNote,
  VideoSessionStatus,
} from '../api/videoSessions'
import { useAuth } from '../context/AuthContext'
import { DoctorPatientTimeline, getDoctorPatientTimeline } from '../api/doctors'
import StructuredIntakeCard from '../components/StructuredIntakeCard'

type PreparedVideoSession = {
  video_session_id: number
  consultation_id?: number | null
  appointment_id?: number | null
  specialty_name: string
  doctor_name: string
  provider: 'daily' | 'mock_daily'
  room_url: string | null
  participant_token: string
  participant_role: 'patient' | 'doctor'
  prepaid_amount_cents?: number
  estimated_minutes?: number
  expires_at: string
}

const STORAGE_KEY = 'sabiodoc-video-session'
const STATUS_POLL_MS = 5000

const formatDuration = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, totalSeconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':')
  }

  return [minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':')
}

export default function VideoConsultationRoom() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [session, setSession] = useState<PreparedVideoSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const [statusData, setStatusData] = useState<VideoSessionStatus | null>(null)
  const [clockNow, setClockNow] = useState(Date.now())
  const [doctorNote, setDoctorNote] = useState('')
  const [followupInstructions, setFollowupInstructions] = useState('')
  const [savingDoctorNote, setSavingDoctorNote] = useState(false)
  const [completingSession, setCompletingSession] = useState(false)
  const [patientTimeline, setPatientTimeline] = useState<DoctorPatientTimeline | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)

  const backPath = session?.participant_role === 'doctor'
    ? session?.appointment_id
      ? '/doctor'
      : '/doctor/video-sessions'
    : session?.appointment_id
      ? '/me/appointments'
      : '/me/consultations'

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    const rawSession = sessionStorage.getItem(STORAGE_KEY)
    if (!rawSession) {
      setLoading(false)
      setError('No hay una videoconsulta preparada en esta sesion.')
      return
    }

    try {
      const parsed = JSON.parse(rawSession) as PreparedVideoSession
      setSession(parsed)
    } catch {
      sessionStorage.removeItem(STORAGE_KEY)
      setError('Los datos de la videoconsulta no son validos.')
      setLoading(false)
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    if (!session) {
      return
    }

    let cancelled = false

    const loadStatus = async () => {
      try {
        const response = await getVideoSessionStatus(session.video_session_id)
        if (!cancelled) {
          setStatusData(response)
          setDoctorNote((current) => current || response.doctor_note || '')
          setFollowupInstructions((current) => current || response.followup_instructions || '')
        }
      } catch (statusError: any) {
        if (!cancelled) {
          setError(statusError.response?.data?.detail || 'No se pudo consultar el estado de la videoconsulta.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadStatus()
    const pollId = window.setInterval(loadStatus, STATUS_POLL_MS)
    const clockId = window.setInterval(() => setClockNow(Date.now()), 1000)

    return () => {
      cancelled = true
      window.clearInterval(pollId)
      window.clearInterval(clockId)
    }
  }, [session])

  useEffect(() => {
    if (!session || session.participant_role !== 'doctor' || !statusData?.patient_id) {
      return
    }

    let cancelled = false

    const loadPatientTimeline = async () => {
      setTimelineLoading(true)
      try {
        const response = await getDoctorPatientTimeline(statusData.patient_id)
        if (!cancelled) {
          setPatientTimeline(response)
        }
      } catch {
        if (!cancelled) {
          setPatientTimeline(null)
        }
      } finally {
        if (!cancelled) {
          setTimelineLoading(false)
        }
      }
    }

    loadPatientTimeline()

    return () => {
      cancelled = true
    }
  }, [session, statusData?.patient_id])

  const handleJoin = async () => {
    if (!session) {
      return
    }
    if (session.provider !== 'mock_daily' && !session.room_url) {
      setError('La sala de Daily no incluye una URL valida.')
      return
    }

    setJoining(true)
    setError(null)
    try {
      const joinedStatus = await joinVideoSession(session.video_session_id)
      setStatusData(joinedStatus)

      if (session.room_url) {
        const encodedToken = encodeURIComponent(session.participant_token)
        const separator = session.room_url.includes('?') ? '&' : '?'
        setIframeUrl(`${session.room_url}${separator}t=${encodedToken}`)
      }
      setJoined(true)
    } catch (joinError: any) {
      console.error('Error joining video room:', joinError)
      setError(joinError.response?.data?.detail || 'No se pudo entrar a la sala de videoconsulta.')
    } finally {
      setJoining(false)
    }
  }

  const handleLeave = async () => {
    setIframeUrl(null)
    setJoined(false)
  }

  const handleSaveDoctorNote = async () => {
    if (!statusData) {
      return
    }
    setSavingDoctorNote(true)
    try {
      const updated = await updateVideoSessionDoctorNote(statusData.video_session_id, { doctor_note: doctorNote })
      setStatusData(updated)
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'No se pudo guardar la nota clínica.')
    } finally {
      setSavingDoctorNote(false)
    }
  }

  const handleCompleteSession = async () => {
    if (!statusData) {
      return
    }
    setCompletingSession(true)
    try {
      const updated = await completeVideoSession(statusData.video_session_id, {
        doctor_note: doctorNote,
        followup_instructions: followupInstructions,
        closed_reason: 'completed_from_room',
      })
      setStatusData(updated)
      setJoined(false)
      setIframeUrl(null)
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'No se pudo cerrar la videoconsulta.')
    } finally {
      setCompletingSession(false)
    }
  }

  const timerView = useMemo(() => {
    const estimatedMinutes = statusData?.estimated_minutes ?? session?.estimated_minutes ?? 0
    const targetSeconds = Math.max(0, estimatedMinutes * 60)

    if (!statusData?.started_at) {
      return {
        elapsedSeconds: 0,
        remainingSeconds: targetSeconds,
        isOvertime: false,
      }
    }

    const startedAt = new Date(statusData.started_at).getTime()
    const endedAt = statusData.ended_at ? new Date(statusData.ended_at).getTime() : clockNow
    const elapsedSeconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000))
    const remainingSeconds = Math.max(0, targetSeconds - elapsedSeconds)
    const isOvertime = elapsedSeconds > targetSeconds && targetSeconds > 0

    return {
      elapsedSeconds,
      remainingSeconds,
      isOvertime,
    }
  }, [clockNow, session?.estimated_minutes, statusData])

  const alertLevel = useMemo(() => {
    if (!statusData?.started_at || statusData.status !== 'active') {
      return null
    }
    if (timerView.isOvertime) {
      return 'overtime'
    }
    if (timerView.remainingSeconds <= 60) {
      return 'one-minute'
    }
    if (timerView.remainingSeconds <= 300) {
      return 'five-minutes'
    }
    return null
  }, [statusData, timerView.isOvertime, timerView.remainingSeconds])

  const formatMoney = (amountCents: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(amountCents / 100)

  const recentClinicalItems = useMemo(() => patientTimeline?.items.slice(0, 3) ?? [], [patientTimeline])
  const statusPresentation = useMemo(() => {
    const status = statusData?.status ?? 'prepared'
    switch (status) {
      case 'active':
        return { label: 'Sesión activa', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
      case 'completed':
        return { label: 'Consulta cerrada', tone: 'bg-slate-100 text-slate-800 border-slate-200' }
      case 'expired':
        return { label: 'Sesión expirada', tone: 'bg-amber-100 text-amber-800 border-amber-200' }
      case 'cancelled':
      case 'failed':
        return { label: 'Sesión no disponible', tone: 'bg-rose-100 text-rose-800 border-rose-200' }
      default:
        return { label: joined ? 'Conectado a la sala' : 'Listo para entrar', tone: 'bg-sky-100 text-sky-800 border-sky-200' }
    }
  }, [joined, statusData?.status])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-10rem)]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sala de videoconsulta</h1>
          <p className="mt-1 text-gray-600">
            {session ? `${session.specialty_name} con ${session.doctor_name}` : 'Preparando entorno de video'}
          </p>
        </div>
        <button
          onClick={() => navigate(backPath)}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
      </div>

      {alertLevel && (
        <div
          className={`mb-6 rounded-2xl border p-4 ${
            alertLevel === 'overtime'
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <div>
              {alertLevel === 'five-minutes' && 'Quedan menos de 5 minutos del tiempo estimado de la videoconsulta.'}
              {alertLevel === 'one-minute' && 'Queda menos de 1 minuto del tiempo estimado. Prepárense para cerrar la consulta.'}
              {alertLevel === 'overtime' && 'La videoconsulta ya superó el tiempo estimado.'}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5" />
            <div>{error}</div>
          </div>
        </div>
      )}

      {statusData?.status === 'completed' && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          La videoconsulta ya fue cerrada. Puedes revisar notas e indicaciones antes de salir.
        </div>
      )}

      {statusData?.status === 'expired' && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          La sala expiró antes de iniciar. Regresa al flujo anterior para preparar una nueva sesión.
        </div>
      )}

      {session && (
        <div className="grid gap-6 xl:grid-cols-[380px,1fr]">
          <aside className="rounded-[32px] border border-stone-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7fafc_100%)] p-6 shadow-sm">
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-gray-500">Estado</p>
                <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${statusPresentation.tone}`}>
                  {statusData?.status === 'active' || joined ? (
                    <Video className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <VideoOff className="h-4 w-4 text-slate-500" />
                  )}
                  {statusPresentation.label}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Tiempo transcurrido</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{formatDuration(timerView.elapsedSeconds)}</p>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-700">Tiempo restante</p>
                  <p className="mt-2 text-3xl font-semibold text-sky-950">
                    {timerView.isOvertime ? `+${formatDuration(timerView.elapsedSeconds - ((statusData?.estimated_minutes ?? session.estimated_minutes ?? 0) * 60))}` : formatDuration(timerView.remainingSeconds)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                  {session.prepaid_amount_cents ? 'Prepago' : 'Sesión'}
                </p>
                {session.prepaid_amount_cents ? (
                  <>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">{formatMoney(session.prepaid_amount_cents)}</p>
                    <p className="mt-1 text-sm text-gray-500">{statusData?.estimated_minutes ?? session.estimated_minutes ?? 0} minutos estimados</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">Cita programada</p>
                    <p className="mt-1 text-sm text-gray-500">{statusData?.estimated_minutes ?? session.estimated_minutes ?? 0} minutos reservados</p>
                  </>
                )}
              </div>

              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-gray-500">Reloj de sesión</p>
                <div className="mt-2 space-y-2 text-sm text-gray-700">
                  <p className="inline-flex items-center gap-2">
                    <Timer className="h-4 w-4 text-emerald-600" />
                    {statusData?.started_at ? `Inició ${new Date(statusData.started_at).toLocaleTimeString('es-ES')}` : 'Aún no inicia'}
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-sky-600" />
                    Vence {new Date(session.expires_at).toLocaleString('es-ES')}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
                En móvil, si cámara o micrófono fallan, abre la sala en una pestaña nueva. El cronómetro y el estado siguen sincronizados desde el backend.
              </div>

              {session.participant_role === 'doctor' && statusData?.patient_id && (
                <button
                  onClick={() => navigate(`/doctor/patients/${statusData.patient_id}`)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <FileText className="h-4 w-4" />
                  Ver historial de {statusData.patient_email}
                </button>
              )}

              {session.participant_role === 'doctor' && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-violet-700">Resumen longitudinal</p>
                  {timelineLoading ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-violet-800">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando antecedentes recientes...
                    </div>
                  ) : recentClinicalItems.length === 0 ? (
                    <p className="mt-3 text-sm text-violet-900">No hay eventos previos visibles para este paciente.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {recentClinicalItems.map((item) => (
                        <div key={`${item.item_type}-${item.consultation_id ?? item.appointment_id}`} className="rounded-2xl border border-violet-100 bg-white/90 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-violet-950">
                              {item.item_type === 'consultation' ? 'Preconsulta IA' : 'Videoconsulta'} · {item.specialty_name}
                            </p>
                            <span className="text-xs text-violet-700">
                              {new Date(item.sort_at).toLocaleDateString('es-ES')}
                            </span>
                          </div>
                          {item.summary && (
                            <p className="mt-2 text-sm text-violet-900 line-clamp-4 whitespace-pre-wrap">{item.summary}</p>
                          )}
                          {item.intake && (
                            <div className="mt-3">
                              <StructuredIntakeCard intake={item.intake} title="Intake reciente" className="border-violet-200 bg-violet-100" />
                            </div>
                          )}
                          {item.doctor_note && (
                            <p className="mt-2 text-sm text-violet-900">
                              <span className="font-medium">Nota médica:</span> {item.doctor_note}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {session.participant_role === 'doctor' && (
                <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">Notas rápidas</p>
                    <textarea
                      value={doctorNote}
                      onChange={(event) => setDoctorNote(event.target.value)}
                      className="input-field mt-3 min-h-28"
                      placeholder="Hallazgos clínicos, indicaciones verbales o seguimiento."
                    />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">Indicaciones postconsulta</p>
                    <textarea
                      value={followupInstructions}
                      onChange={(event) => setFollowupInstructions(event.target.value)}
                      className="input-field mt-3 min-h-28"
                      placeholder="Indicaciones para el paciente, red flags y próximos pasos."
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleSaveDoctorNote}
                      disabled={savingDoctorNote}
                      className="inline-flex items-center justify-center rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
                    >
                      {savingDoctorNote ? 'Guardando...' : 'Guardar nota'}
                    </button>
                    <button
                      onClick={handleCompleteSession}
                      disabled={completingSession || statusData?.status === 'completed'}
                      className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {completingSession ? 'Cerrando...' : 'Cerrar videoconsulta'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <button
                  onClick={handleJoin}
                  disabled={joining || joined || ['completed', 'cancelled', 'expired', 'failed'].includes(statusData?.status || '')}
                  className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-50"
                >
                  {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                  {joining ? 'Conectando...' : 'Entrar a la sala'}
                </button>

                <button
                  onClick={handleLeave}
                  disabled={!joined}
                  className="btn-secondary w-full disabled:opacity-50"
                >
                  Salir de la sala
                </button>

                {session.room_url && (
                  <a
                    href={`${session.room_url}${session.room_url.includes('?') ? '&' : '?'}t=${encodeURIComponent(session.participant_token)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-center text-sm text-primary-600 hover:text-primary-700"
                  >
                    Abrir sala autenticada en una pestaña nueva
                  </a>
                )}
              </div>
            </div>
          </aside>

          <section className="rounded-[28px] border border-slate-900/10 bg-slate-950 p-3 shadow-xl">
            {session.provider === 'mock_daily' ? (
              <div className="flex min-h-[560px] flex-col items-center justify-center rounded-[20px] border border-dashed border-white/20 bg-slate-900 p-8 text-center text-white">
                <Video className="h-14 w-14 text-emerald-400" />
                <h2 className="mt-4 text-2xl font-semibold">Sala mock de Daily</h2>
                <p className="mt-3 max-w-xl text-sm text-slate-300">
                  Esta sesión usa el proveedor simulado. El cronómetro y las alertas siguen funcionando con el reloj compartido del backend.
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-400">Rol: {session.participant_role}</p>
              </div>
            ) : (
              <div className="min-h-[560px] overflow-hidden rounded-[20px] bg-slate-900">
                {iframeUrl ? (
                  <iframe
                    src={iframeUrl}
                    title="Daily video room"
                    allow="camera; microphone; fullscreen; display-capture; autoplay"
                    className="h-[560px] w-full border-0"
                  />
                ) : (
                  <div className="flex h-[560px] items-center justify-center text-center text-white">
                    <div>
                      <Video className="mx-auto h-14 w-14 text-emerald-400" />
                      <p className="mt-4 text-lg font-medium">La sala está lista.</p>
                      <p className="mt-2 max-w-md text-sm text-slate-300">
                        Pulsa &quot;Entrar a la sala&quot; para fijar el inicio compartido y abrir Daily dentro de SabioDoc.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
