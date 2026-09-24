import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  LogOut,
  Mic,
  Pause,
  Paperclip,
  Play,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Timer,
  UserRound,
  Video,
  VideoOff,
} from 'lucide-react'

import {
  completeVideoSession,
  generateVideoSessionIntro,
  getVideoSessionStatus,
  joinVideoSession,
  leaveVideoSession,
  pauseVideoSession,
  startVideoSession,
  updateVideoSessionDoctorNote,
  uploadVideoSessionFile,
  VideoSessionFile,
  VideoSessionStatus,
} from '../api/videoSessions'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { DoctorPatientTimeline, getDoctorPatientTimeline } from '../api/doctors'
import { formatMoney } from '../utils/format'
import ConfirmDialog from '../components/ConfirmDialog'
import Button from '../components/ui/Button'
import { Textarea } from '../components/ui/Field'
import RichText from '../components/RichText'
import StructuredIntakeCard from '../components/StructuredIntakeCard'
import SummaryToggleButton from '../components/SummaryToggleButton'
import { deleteFile } from '../api/files'
import JitsiMeeting from '../components/JitsiMeeting'
import SessionFilesPanel from '../components/SessionFilesPanel'
import { getApiErrorMessage } from '../utils/apiError'

type PreparedVideoSession = {
  video_session_id: number
  consultation_id?: number | null
  appointment_id?: number | null
  specialty_name: string
  doctor_name: string
  provider: 'jitsi' | 'jitsi_mock'
  room_url: string | null
  participant_token: string | null
  participant_role: 'patient' | 'doctor'
  prepaid_amount_cents?: number
  estimated_minutes?: number
  expires_at: string
}

type DoctorTab = 'session' | 'history' | 'notes' | 'files'

const MAX_SESSION_FILES = 10

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

const formatClock = (value: string | null | undefined) => {
  if (!value) return null
  return new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function historyItemKey(item: DoctorPatientTimeline['items'][number]): string {
  return `${item.item_type}-${item.consultation_id ?? item.appointment_id}`
}

const HISTORY_ITEM_TYPE_LABELS: Record<DoctorPatientTimeline['items'][number]['item_type'], string> = {
  consultation: 'Preconsulta IA',
  appointment: 'Cita',
  video_session: 'Videoconsulta',
}

/** Vista previa en texto plano de un resumen con Markdown para el tab de historial. */
function historyPreview(item: DoctorPatientTimeline['items'][number]): string | null {
  if (item.intake?.chief_complaint) return item.intake.chief_complaint
  if (!item.summary) return null
  const plain = item.summary
    .replace(/[#*_>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > 140 ? `${plain.slice(0, 140).trimEnd()}…` : plain
}

export default function VideoConsultationRoom() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const toast = useToast()
  const [mediaStatus, setMediaStatus] = useState<'unknown' | 'checking' | 'ok' | 'denied' | 'unsupported'>('unknown')
  const [session, setSession] = useState<PreparedVideoSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openedExternally, setOpenedExternally] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<VideoSessionFile | null>(null)
  const [deletingFile, setDeletingFile] = useState(false)
  const [statusData, setStatusData] = useState<VideoSessionStatus | null>(null)
  const [clockNow, setClockNow] = useState(Date.now())
  const [doctorNote, setDoctorNote] = useState('')
  const [followupInstructions, setFollowupInstructions] = useState('')
  const [savingDoctorNote, setSavingDoctorNote] = useState(false)
  const [completingSession, setCompletingSession] = useState(false)
  const [timerBusy, setTimerBusy] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmStart, setConfirmStart] = useState(false)
  const [activeTab, setActiveTab] = useState<DoctorTab>('session')
  const [introLoading, setIntroLoading] = useState(false)
  const [introCopied, setIntroCopied] = useState(false)
  const [patientTimeline, setPatientTimeline] = useState<DoctorPatientTimeline | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [expandedHistoryItems, setExpandedHistoryItems] = useState<Set<string>>(new Set())
  const introRequestedRef = useRef(false)

  const isDoctor = session?.participant_role === 'doctor'

  const backPath = isDoctor
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
      setError('No hay una videoconsulta preparada en esta sesión.')
      return
    }

    try {
      const parsed = JSON.parse(rawSession) as PreparedVideoSession
      setSession(parsed)
    } catch {
      sessionStorage.removeItem(STORAGE_KEY)
      setError('Los datos de la videoconsulta no son válidos.')
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

  // Si la videollamada termina (por ejemplo, al agotarse los créditos), cerramos la sala.
  const videoStatus = statusData?.status
  useEffect(() => {
    if (!videoStatus) return
    if (['completed', 'cancelled', 'expired', 'failed'].includes(videoStatus)) {
      setJoined(false)
    }
  }, [videoStatus])

  // El médico recibe un guion de apertura generado por IA antes de iniciar.
  useEffect(() => {
    if (!session || session.participant_role !== 'doctor' || !statusData) {
      return
    }
    if (introRequestedRef.current) {
      return
    }
    if (statusData.intro_script || statusData.started_at || (statusData.billable_seconds ?? 0) > 0) {
      introRequestedRef.current = true
      return
    }
    introRequestedRef.current = true
    setIntroLoading(true)
    generateVideoSessionIntro(session.video_session_id)
      .then((response) => setStatusData(response))
      .catch(() => {
        /* el texto de respaldo se genera en el backend; si falla, se reintenta al reabrir */
      })
      .finally(() => setIntroLoading(false))
  }, [session, statusData])

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
    if (session.provider !== 'jitsi_mock' && !session.room_url) {
      setError('La sala no incluye una URL válida.')
      return
    }

    setJoining(true)
    setError(null)
    try {
      const joinedStatus = await joinVideoSession(session.video_session_id)
      setStatusData(joinedStatus)
      setJoined(true)
    } catch (joinError: any) {
      console.error('Error joining video room:', joinError)
      setError(joinError.response?.data?.detail || 'No se pudo entrar a la sala de videoconsulta.')
    } finally {
      setJoining(false)
    }
  }

  const handleOpenExternal = async () => {
    if (!session?.room_url) {
      setError('La sala no incluye una URL válida.')
      return
    }
    window.open(session.room_url, '_blank', 'noopener,noreferrer')
    setOpenedExternally(true)
    if (!joined) {
      await handleJoin()
    }
  }

  const handleUploadFile = async (file: File) => {
    if (!session) return
    setUploadingFile(true)
    setError(null)
    try {
      const record = await uploadVideoSessionFile(session.video_session_id, file)
      setStatusData((current) =>
        current ? { ...current, files: [...current.files, record] } : current,
      )
    } catch (uploadError: unknown) {
      setError(getApiErrorMessage(uploadError, 'No se pudo subir el archivo.'))
    } finally {
      setUploadingFile(false)
    }
  }

  const handleDeleteFile = async () => {
    if (!session || !fileToDelete) return
    setDeletingFile(true)
    setError(null)
    try {
      await deleteFile(fileToDelete.id)
      setStatusData((current) =>
        current
          ? { ...current, files: current.files.filter((file) => file.id !== fileToDelete.id) }
          : current,
      )
      setFileToDelete(null)
    } catch (deleteError: unknown) {
      setError(getApiErrorMessage(deleteError, 'No se pudo borrar el archivo.'))
    } finally {
      setDeletingFile(false)
    }
  }

  const handleLeave = async () => {
    if (statusData) {
      try {
        const updated = await leaveVideoSession(statusData.video_session_id)
        setStatusData(updated)
      } catch (leaveError: any) {
        console.error('Error leaving video room:', leaveError)
        setError(leaveError.response?.data?.detail || 'No se pudo registrar la salida de la sala.')
      }
    }
    setOpenedExternally(false)
    setJoined(false)
  }

  const handleStartTimer = async () => {
    if (!statusData) return
    setTimerBusy(true)
    try {
      setStatusData(await startVideoSession(statusData.video_session_id))
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'No se pudo iniciar el cronómetro.')
    } finally {
      setTimerBusy(false)
    }
  }

  const handlePauseTimer = async () => {
    if (!statusData) return
    setTimerBusy(true)
    try {
      setStatusData(await pauseVideoSession(statusData.video_session_id))
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'No se pudo pausar el cronómetro.')
    } finally {
      setTimerBusy(false)
    }
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
      setOpenedExternally(false)
      setConfirmComplete(false)
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'No se pudo cerrar la videoconsulta.')
    } finally {
      setCompletingSession(false)
    }
  }

  const handleCopyIntro = async () => {
    if (!statusData?.intro_script) return
    try {
      await navigator.clipboard.writeText(statusData.intro_script)
      setIntroCopied(true)
      window.setTimeout(() => setIntroCopied(false), 2000)
    } catch {
      /* portapapeles no disponible */
    }
  }

  // Comprueba (y solicita) acceso a cámara y micrófono antes de entrar.
  const handleCheckDevices = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaStatus('unsupported')
      toast.error('Tu navegador no permite comprobar los dispositivos desde aquí.')
      return
    }
    setMediaStatus('checking')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      stream.getTracks().forEach((track) => track.stop())
      setMediaStatus('ok')
      toast.success('Cámara y micrófono listos.')
    } catch {
      setMediaStatus('denied')
      toast.error('No pudimos acceder a tu cámara o micrófono. Revisa los permisos del navegador.')
    }
  }

  const timerView = useMemo(() => {
    const estimatedMinutes = statusData?.estimated_minutes ?? session?.estimated_minutes ?? 0
    const targetSeconds = Math.max(0, estimatedMinutes * 60)
    const accumulated = statusData?.billable_seconds ?? 0

    if (!statusData?.started_at) {
      return {
        elapsedSeconds: accumulated,
        remainingSeconds: Math.max(0, targetSeconds - accumulated),
        isOvertime: accumulated > targetSeconds && targetSeconds > 0,
      }
    }

    const startedAt = new Date(statusData.started_at).getTime()
    const endedAt = statusData.ended_at ? new Date(statusData.ended_at).getTime() : clockNow
    const elapsedSeconds = accumulated + Math.max(0, Math.floor((endedAt - startedAt) / 1000))
    const remainingSeconds = Math.max(0, targetSeconds - elapsedSeconds)
    const isOvertime = elapsedSeconds > targetSeconds && targetSeconds > 0

    return { elapsedSeconds, remainingSeconds, isOvertime }
  }, [clockNow, session?.estimated_minutes, statusData])

  const hasStarted = Boolean(statusData?.started_at) || (statusData?.billable_seconds ?? 0) > 0
  const isRunning = Boolean(statusData?.started_at)

  const alertLevel = useMemo(() => {
    if (!hasStarted || statusData?.status !== 'active') {
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
  }, [hasStarted, statusData?.status, timerView.isOvertime, timerView.remainingSeconds])

  const recentClinicalItems = useMemo(() => {
    const items = patientTimeline?.items ?? []
    const currentAppointmentId = session?.appointment_id ?? null
    const currentVideoSessionId = session?.video_session_id ?? null

    // "Antecedentes recientes" excluye el evento que se está atendiendo ahora
    // mismo (la cita/videoconsulta actual), que aún no es historia clínica.
    return items
      .filter((item) => {
        if (
          item.item_type === 'appointment' &&
          currentAppointmentId !== null &&
          item.appointment_id === currentAppointmentId
        ) {
          return false
        }
        if (
          item.item_type === 'video_session' &&
          currentVideoSessionId !== null &&
          item.video_session_id === currentVideoSessionId
        ) {
          return false
        }
        return true
      })
      .slice(0, 3)
  }, [patientTimeline, session])

  const toggleHistoryItem = (key: string) => {
    setExpandedHistoryItems((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const estimatedMinutes = statusData?.estimated_minutes ?? session?.estimated_minutes ?? 0
  const targetSeconds = Math.max(0, estimatedMinutes * 60)

  const doctorInRoom = Boolean(statusData?.doctor_present)
  const patientInRoom = Boolean(statusData?.patient_present)
  // Presencia actual (el cronometro solo corre con ambos).
  const bothPresent = Boolean(statusData?.both_present)
  const heldAmountCents = statusData?.held_amount_cents ?? session?.prepaid_amount_cents ?? 0
  const currentCostCents = statusData?.current_cost_cents ?? 0
  const counterpartJoinedAt = isDoctor ? statusData?.joined_patient_at : statusData?.joined_doctor_at
  const counterpartLabel = isDoctor ? 'Paciente' : 'Médico'
  const selfJoinedAt = isDoctor ? statusData?.joined_doctor_at : statusData?.joined_patient_at
  const selfInRoom = (isDoctor ? doctorInRoom : patientInRoom) || joined
  const counterpartInRoom = isDoctor ? patientInRoom : doctorInRoom
  const counterpartArticle = isDoctor ? 'El paciente' : 'El médico'
  const counterpartNoun = isDoctor ? 'el paciente' : 'el médico'
  const waitingMessage = counterpartInRoom
    ? `${counterpartArticle} ya está en la sala. Entra cuando quieras.`
    : `La sala está lista. Entra y espera a que se conecte ${counterpartNoun}.`

  const statusPresentation = useMemo(() => {
    const status = statusData?.status ?? 'prepared'
    switch (status) {
      case 'active':
        return { label: 'Consulta en curso', tone: 'border-emerald-200 bg-emerald-100 text-emerald-800', Icon: Video }
      case 'completed':
        return { label: 'Consulta finalizada', tone: 'border-slate-200 bg-slate-100 text-slate-700', Icon: CheckCircle2 }
      case 'expired':
        return { label: 'Sala expirada', tone: 'border-amber-200 bg-amber-100 text-amber-800', Icon: Clock3 }
      case 'cancelled':
      case 'failed':
        return { label: 'Sala no disponible', tone: 'border-rose-200 bg-rose-100 text-rose-800', Icon: VideoOff }
      default: {
        if (selfInRoom && counterpartInRoom) {
          return { label: 'Ambos conectados', tone: 'border-emerald-200 bg-emerald-100 text-emerald-800', Icon: Video }
        }
        if (counterpartInRoom) {
          return { label: `${counterpartLabel} en la sala`, tone: 'border-emerald-200 bg-emerald-100 text-emerald-800', Icon: Video }
        }
        if (selfInRoom) {
          return { label: `Esperando al ${counterpartLabel.toLowerCase()}`, tone: 'border-sky-200 bg-sky-100 text-sky-800', Icon: Video }
        }
        return { label: 'Sala preparada', tone: 'border-sky-200 bg-sky-100 text-sky-800', Icon: VideoOff }
      }
    }
  }, [statusData?.status, selfInRoom, counterpartInRoom, counterpartLabel])

  const joinBlocked = ['completed', 'cancelled', 'expired', 'failed'].includes(statusData?.status || '')
  const canJoin = !joined && !joinBlocked && (session?.provider === 'jitsi_mock' || Boolean(session?.room_url))
  const showMeeting =
    Boolean(joined) &&
    !openedExternally &&
    session?.provider !== 'jitsi_mock' &&
    Boolean(session?.room_url)
  const meetingDisplayName =
    (isDoctor ? user?.doctor_display_name : user?.patient_display_name) || user?.display_name || undefined

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
      </div>
    )
  }

  const StatusIcon = statusPresentation.Icon

  const doctorTabs: Array<{ key: DoctorTab; label: string; Icon: typeof Timer }> = [
    { key: 'session', label: 'Sesión', Icon: Timer },
    { key: 'history', label: 'Historial', Icon: FileText },
    { key: 'files', label: 'Archivos', Icon: Paperclip },
    { key: 'notes', label: 'Notas', Icon: ClipboardList },
  ]

  const sessionContent = (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</p>
        {!hasStarted ? (
          <div className="mt-2 flex items-start gap-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-800">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {isDoctor
                ? 'Aún no has iniciado el cronómetro de la consulta.'
                : 'La consulta aún no ha comenzado. El médico iniciará el cronómetro cuando empiece.'}
            </p>
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Transcurrido</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatDuration(timerView.elapsedSeconds)}</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
              <p className="text-xs uppercase tracking-wide text-sky-700">Restante</p>
              <p className="mt-1 text-2xl font-semibold text-sky-900">
                {timerView.isOvertime
                  ? `+${formatDuration(timerView.elapsedSeconds - targetSeconds)}`
                  : formatDuration(timerView.remainingSeconds)}
              </p>
            </div>
          </div>
        )}
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="inline-flex items-center gap-2 text-slate-500">
            <UserRound className="h-4 w-4" /> Tú
          </dt>
          <dd className="font-medium text-slate-800">
            {selfJoinedAt ? `Conectado ${formatClock(selfJoinedAt)}` : 'Aún no entras'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="inline-flex items-center gap-2 text-slate-500">
            <Stethoscope className="h-4 w-4" /> {counterpartLabel}
          </dt>
          <dd className="font-medium text-slate-800">
            {counterpartJoinedAt ? `En la sala ${formatClock(counterpartJoinedAt)}` : 'Aún no se conecta'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="inline-flex items-center gap-2 text-slate-500">
            <Timer className="h-4 w-4" /> Cronómetro
          </dt>
          <dd className="font-medium text-slate-800">
            {statusData?.started_at ? `Inició ${formatClock(statusData.started_at)}` : 'Pendiente'}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
        <div>
          <p className="text-slate-500">Duración estimada</p>
          <p className="font-medium text-slate-800">{estimatedMinutes} min</p>
        </div>
        <div>
          <p className="text-slate-500">Costo real de la sesión</p>
          <p className="font-medium text-emerald-700">
            {formatMoney(currentCostCents)}
            {heldAmountCents > 0 && (
              <span className="ml-1 text-xs font-normal text-slate-500">de {formatMoney(heldAmountCents)} retenidos</span>
            )}
          </p>
        </div>
      </div>

      <div
        className={`rounded-xl px-3 py-2 text-sm ${
          bothPresent ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
        }`}
      >
        {bothPresent
          ? 'Ambos están en la sala: el cronómetro puede correr.'
          : `El cronómetro está en pausa: falta ${isDoctor ? 'el paciente' : 'el médico'} en la sala.`}
      </div>
    </div>
  )

  const devicesContent = (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-slate-800">
        <Camera className="h-4 w-4 text-primary-600" aria-hidden="true" /> Cámara y micrófono
      </p>
      <p className="mt-2 text-slate-600">
        {mediaStatus === 'ok'
          ? 'Todo listo: tu cámara y micrófono funcionan.'
          : mediaStatus === 'denied'
            ? 'No pudimos acceder. Revisa los permisos del navegador y vuelve a comprobar.'
            : mediaStatus === 'unsupported'
              ? 'Tu navegador no permite comprobar los dispositivos; la sala los pedirá al entrar.'
              : 'Comprueba tus dispositivos antes de entrar a la consulta.'}
      </p>
      <Button
        variant={mediaStatus === 'ok' ? 'secondary' : 'primary'}
        size="sm"
        className="mt-3"
        onClick={handleCheckDevices}
        loading={mediaStatus === 'checking'}
        leftIcon={<Camera className="h-4 w-4" />}
      >
        {mediaStatus === 'ok' ? 'Volver a comprobar' : 'Comprobar cámara y micrófono'}
      </Button>
    </div>
  )

  const introContent = isDoctor && !hasStarted && (
    <div className="rounded-xl border border-primary-100 bg-primary-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary-900">
          <Sparkles className="h-4 w-4" /> Introducción para iniciar
        </p>
        {introLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
        ) : (
          statusData?.intro_script && (
            <button
              type="button"
              onClick={handleCopyIntro}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-900"
            >
              <Copy className="h-3.5 w-3.5" />
              {introCopied ? 'Copiado' : 'Copiar'}
            </button>
          )
        )}
      </div>
      <p className="mt-1 text-xs text-primary-700">
        Léela en voz alta antes de iniciar. Ayuda a identificar cada voz en la transcripción de la consulta.
      </p>
      <blockquote className="mt-2 rounded-lg bg-white p-3 text-sm text-slate-800">
        {statusData?.intro_script || (introLoading ? 'Generando introducción…' : 'Introducción no disponible.')}
      </blockquote>
    </div>
  )

  const openPatientHistory = () => {
    if (!statusData?.patient_id) return
    window.open(`/doctor/patients/${statusData.patient_id}`, '_blank')
  }

  const historyContent = isDoctor && (
    <div>
      {statusData?.patient_id && (
        <button
          type="button"
          onClick={openPatientHistory}
          className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ExternalLink className="h-4 w-4" />
          Ver historial del paciente
        </button>
      )}
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Antecedentes recientes</p>
      {timelineLoading ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando antecedentes...
        </div>
      ) : recentClinicalItems.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No hay eventos previos visibles para este paciente.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {recentClinicalItems.map((item) => {
            const key = historyItemKey(item)
            const isExpanded = expandedHistoryItems.has(key)
            const preview = historyPreview(item)
            const hasDetails = Boolean(item.summary || item.intake || item.doctor_note)

            return (
              <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {HISTORY_ITEM_TYPE_LABELS[item.item_type]} · {item.specialty_name}
                  </p>
                  <span className="text-xs text-slate-500">
                    {new Date(item.sort_at).toLocaleDateString('es-ES')}
                  </span>
                </div>

                {preview && <p className="mt-2 line-clamp-2 text-xs text-slate-600">{preview}</p>}

                {hasDetails && (
                  <SummaryToggleButton
                    expanded={isExpanded}
                    onClick={() => toggleHistoryItem(key)}
                    size="sm"
                    className="mt-2 w-full"
                  />
                )}

                {isExpanded && hasDetails && (
                  <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                    {item.summary && (
                      <div className="max-h-40 overflow-y-auto rounded-lg bg-white p-3">
                        <RichText text={item.summary} className="text-sm text-slate-700" />
                      </div>
                    )}
                    {item.intake && (
                      <StructuredIntakeCard intake={item.intake} title="Ficha clínica estructurada" />
                    )}
                    {item.doctor_note && (
                      <p className="text-sm text-slate-700">
                        <span className="font-medium">Nota médica:</span> {item.doctor_note}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const notesContent = isDoctor && (
    <div className="space-y-4">
      <Textarea
        label="Notas clínicas"
        value={doctorNote}
        onChange={(event) => setDoctorNote(event.target.value)}
        className="min-h-32"
        placeholder="Hallazgos clínicos, indicaciones verbales o seguimiento."
      />
      <Textarea
        label="Indicaciones postconsulta"
        value={followupInstructions}
        onChange={(event) => setFollowupInstructions(event.target.value)}
        className="min-h-32"
        placeholder="Indicaciones para el paciente, signos de alarma y próximos pasos."
      />
      <Button
        variant="secondary"
        onClick={handleSaveDoctorNote}
        loading={savingDoctorNote}
        leftIcon={<CheckCircle2 className="h-4 w-4" />}
        className="w-full"
      >
        {savingDoctorNote ? 'Guardando...' : 'Guardar nota'}
      </Button>
    </div>
  )

  const filesContent = (
    <SessionFilesPanel
      files={statusData?.files ?? []}
      enabled={Boolean(statusData?.files_enabled)}
      maxFiles={MAX_SESSION_FILES}
      currentRole={session?.participant_role ?? 'patient'}
      uploading={uploadingFile}
      onSelectFile={handleUploadFile}
      onDelete={setFileToDelete}
      deletingId={deletingFile ? fileToDelete?.id ?? null : null}
    />
  )

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-slate-50 p-2 sm:p-3 lg:p-4">
      <header className="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary-100 p-2.5">
            <Stethoscope className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Sala de videoconsulta</h1>
            <p className="mt-0.5 text-sm text-slate-600">
              {session
                ? isDoctor
                  ? `Paciente: ${statusData?.patient_name || statusData?.patient_email || '—'}`
                  : `${session.specialty_name} · ${session.doctor_name}`
                : 'Preparando entorno de video'}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={() => navigate(backPath)}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Volver
        </Button>
      </header>

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2" aria-live="polite">
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${statusPresentation.tone}`}>
          <StatusIcon className="h-4 w-4" />
          {statusPresentation.label}
        </span>
      </div>

      {alertLevel && (
        <div
          className={`mb-3 shrink-0 rounded-2xl border p-3 ${
            alertLevel === 'overtime'
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-sm">
              {alertLevel === 'five-minutes' && (
                <>
                  Quedan menos de 5 minutos del tiempo reservado. Si necesitan extender la consulta se
                  consumirán créditos adicionales ({formatMoney(statusData?.price_per_min_cents ?? 0)}/min); si
                  no hay saldo, la videollamada finalizará automáticamente.
                </>
              )}
              {alertLevel === 'one-minute' &&
                'Queda menos de 1 minuto del tiempo reservado. Al terminar, la consulta pasará a tiempo extra (se consumen créditos) o finalizará si el paciente no tiene saldo.'}
              {alertLevel === 'overtime' &&
                'Tiempo extra en curso: se están consumiendo créditos del paciente.'}
            </div>
          </div>
        </div>
      )}

      {statusData?.billing_mode === 'overtime' && (
        <div className="mb-3 shrink-0 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Tiempo extra en curso</p>
              <p className="mt-0.5">
                Consumido en tiempo extra: {formatMoney(statusData.overtime_amount_cents)}.{' '}
                {isDoctor
                  ? `Saldo del paciente: ${formatMoney(statusData.patient_balance_cents)}.`
                  : `Tu saldo disponible: ${formatMoney(statusData.patient_balance_cents)}.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {statusData?.status === 'active' &&
        statusData.billing_mode !== 'overtime' &&
        !statusData.can_afford_overtime &&
        (statusData.estimated_minutes ?? 0) > 0 &&
        (statusData.remaining_seconds ?? 0) <= 300 && (
          <div className="mb-3 shrink-0 rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                {isDoctor
                  ? 'El paciente no tiene créditos suficientes para extender la consulta. Al terminar el tiempo reservado, la videollamada finalizará automáticamente.'
                  : 'No tienes créditos suficientes para extender la consulta. Al terminar el tiempo reservado, la videollamada finalizará automáticamente. Recarga créditos para evitarlo.'}
              </div>
            </div>
          </div>
        )}

      {error && (
        <div className="mb-3 shrink-0 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{error}</div>
          </div>
        </div>
      )}

      {statusData?.status === 'completed' && (
        <div className="mb-3 shrink-0 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {statusData.closed_reason === 'completed_no_credits'
            ? 'La videoconsulta finalizó automáticamente porque el paciente se quedó sin créditos.'
            : 'La videoconsulta ya fue cerrada. Puedes revisar notas e indicaciones antes de salir.'}
        </div>
      )}

      {statusData?.status === 'expired' && (
        <div className="mb-3 shrink-0 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          La sala expiró antes de iniciar. Regresa al flujo anterior para preparar una nueva sesión.
        </div>
      )}

      {session && (
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-rows-1 lg:gap-4 lg:overflow-hidden lg:grid-cols-[minmax(0,1fr)_clamp(340px,26vw,440px)]">
          {/* Video protagonista */}
          <section className="flex min-h-0 flex-col">
            <div className="aspect-video w-full overflow-hidden rounded-3xl border border-slate-900/10 bg-slate-950 shadow-xl lg:aspect-auto lg:min-h-0 lg:flex-1">
              {showMeeting ? (
                <JitsiMeeting
                  roomUrl={session.room_url ?? ''}
                  jwt={session.participant_token}
                  displayName={meetingDisplayName}
                  email={user?.email}
                  onLeft={() => {
                    void handleLeave()
                  }}
                  onError={(message) => setError(message)}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center text-white">
                  {session.provider === 'jitsi_mock' ? (
                    <Video className="h-14 w-14 text-emerald-400" />
                  ) : joined ? (
                    <ExternalLink className="h-14 w-14 text-emerald-400" />
                  ) : (
                    <VideoOff className="h-14 w-14 text-slate-500" />
                  )}

                  <div>
                    <h2 className="text-xl font-semibold sm:text-2xl">
                      {session.provider === 'jitsi_mock'
                        ? 'Sala simulada'
                        : joined
                          ? 'Sala abierta en otra pestaña'
                          : 'Tu videoconsulta está lista'}
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-300">
                      {session.provider === 'jitsi_mock'
                        ? 'Esta sesión usa el proveedor simulado. El estado y el tiempo se sincronizan con el backend.'
                        : joined
                          ? 'Si cierras la otra pestaña, puedes volver a abrir la sala aquí.'
                          : waitingMessage}
                    </p>
                  </div>

                  {!joined && canJoin && (
                    <Button
                      size="lg"
                      onClick={() => handleJoin()}
                      loading={joining}
                      leftIcon={<Video className="h-5 w-5" />}
                    >
                      {joining ? 'Conectando...' : 'Entrar a la sala'}
                    </Button>
                  )}

                  {joined && !showMeeting && session.room_url && session.provider !== 'jitsi_mock' && (
                    <button type="button"
                      onClick={handleOpenExternal}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Volver a abrir la sala
                    </button>
                  )}

                  {joinBlocked && <p className="text-sm text-amber-300">Esta sala ya no está disponible.</p>}
                </div>
              )}
            </div>

            {session.provider !== 'jitsi_mock' && session.room_url && !joined && (
              <button
                type="button"
                onClick={handleOpenExternal}
                className="mt-2 shrink-0 text-center text-sm text-primary-600 hover:text-primary-700"
              >
                ¿Problemas con cámara o micrófono? Abrir la sala en una pestaña nueva
              </button>
            )}
          </section>

          {/* Panel lateral con tabs y scroll propio */}
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {isDoctor && (
              <div role="tablist" aria-label="Panel de la consulta" className="flex shrink-0 gap-1 border-b border-slate-100 p-2">
                {doctorTabs.map(({ key, label, Icon }) => {
                  const selected = activeTab === key
                  return (
                    <button type="button"
                      key={key}
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActiveTab(key)}
                      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                        selected ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  )
                })}
              </div>
            )}

            <div role="tabpanel" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {!isDoctor && (
                <>
                  {introContent}
                  {sessionContent}
                  {devicesContent}
                  {filesContent}
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                    <p className="flex items-center gap-2 font-medium text-slate-800">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" /> Antes de empezar
                    </p>
                    <ul className="mt-2 space-y-2">
                      <li className="flex items-start gap-2">
                        <Mic className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                        Permite el acceso a tu cámara y micrófono cuando el navegador lo solicite.
                      </li>
                      <li className="flex items-start gap-2">
                        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                        Si algo falla, abre la sala en una pestaña nueva; el estado seguirá sincronizado.
                      </li>
                    </ul>
                  </div>
                </>
              )}

              {isDoctor && activeTab === 'session' && (
                <>
                  {introContent}
                  {sessionContent}
                  {devicesContent}
                </>
              )}
              {isDoctor && activeTab === 'history' && historyContent}
              {isDoctor && activeTab === 'files' && filesContent}
              {isDoctor && activeTab === 'notes' && notesContent}
            </div>

            {/* Barra de acciones fija */}
            <div className="shrink-0 space-y-2 border-t border-slate-100 p-4">
              {!isDoctor && (
                <>
                  {joined ? (
                    <Button
                      variant="secondary"
                      onClick={handleLeave}
                      leftIcon={<LogOut className="h-4 w-4" />}
                      className="w-full"
                    >
                      Salir de la sala
                    </Button>
                  ) : (
                    canJoin && (
                      <Button
                        onClick={() => handleJoin()}
                        loading={joining}
                        leftIcon={<Video className="h-4 w-4" />}
                        className="w-full"
                      >
                        {joining ? 'Conectando...' : 'Entrar a la sala'}
                      </Button>
                    )
                  )}
                </>
              )}

              {isDoctor && (
                <>
                  <div className="flex gap-2">
                    {isRunning ? (
                      <Button
                        variant="secondary"
                        onClick={handlePauseTimer}
                        loading={timerBusy}
                        leftIcon={<Pause className="h-4 w-4" />}
                        className="flex-1"
                      >
                        Pausar
                      </Button>
                    ) : (
                      <Button
                        onClick={() => (hasStarted ? handleStartTimer() : setConfirmStart(true))}
                        disabled={timerBusy || joinBlocked || (!hasStarted && introLoading) || !bothPresent}
                        title={!bothPresent ? 'El paciente debe estar en la sala para iniciar' : undefined}
                        loading={timerBusy}
                        leftIcon={<Play className="h-4 w-4" />}
                        className="flex-1"
                      >
                        {hasStarted ? 'Reanudar consulta' : 'Iniciar consulta'}
                      </Button>
                    )}
                    <button type="button"
                      onClick={() => setConfirmComplete(true)}
                      disabled={joinBlocked || statusData?.status === 'completed'}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Finalizar
                    </button>
                  </div>
                  {!bothPresent && !joinBlocked && (
                    <p className="text-xs text-amber-700">
                      El cronómetro solo corre cuando el paciente y tú están en la sala.
                    </p>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmStart}
        tone="default"
        title="¿Iniciar la videoconsulta?"
        description="Antes de iniciar, confirma que ya leíste en voz alta la introducción y que ambos se identificaron con su nombre. Una vez iniciado, el conteo no se puede reiniciar: solo se puede pausar y reanudar."
        confirmLabel="Iniciar consulta"
        busy={timerBusy}
        onConfirm={async () => {
          await handleStartTimer()
          setConfirmStart(false)
        }}
        onCancel={() => setConfirmStart(false)}
      />

      <ConfirmDialog
        open={confirmComplete}
        tone="danger"
        title="¿Finalizar la videoconsulta?"
        description="Se guardarán tus notas e indicaciones y la cita se marcará como completada. Esta acción no se puede deshacer."
        confirmLabel="Finalizar"
        busy={completingSession}
        onConfirm={handleCompleteSession}
        onCancel={() => setConfirmComplete(false)}
      />

      <ConfirmDialog
        open={fileToDelete !== null}
        tone="danger"
        title="¿Borrar el archivo?"
        description={
          fileToDelete
            ? `Se eliminará "${fileToDelete.original_name}" de esta sesión.`
            : undefined
        }
        confirmLabel="Borrar archivo"
        busy={deletingFile}
        onConfirm={handleDeleteFile}
        onCancel={() => {
          if (!deletingFile) setFileToDelete(null)
        }}
      />
    </div>
  )
}
