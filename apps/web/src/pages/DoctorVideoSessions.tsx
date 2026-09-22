import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock3, ExternalLink, FileText, RefreshCcw, UserRound, Video } from 'lucide-react'

import { getMyDoctorVideoSessions, DoctorVideoSession } from '../api/doctors'
import { VIDEO_SESSION_STATUS_LABELS, VIDEO_SESSION_STATUS_TONES } from '../utils/statusLabels'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import { formatMoney } from '../utils/format'
import BackButton from '../components/BackButton'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/Pagination'
import Skeleton from '../components/ui/Skeleton'
import { usePagination } from '../hooks/usePagination'

export default function DoctorVideoSessions() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [sessions, setSessions] = useState<DoctorVideoSession[]>([])
  const [loading, setLoading] = useState(true)
  const { page, setPage, pageItems, totalPages, totalItems, pageSize } = usePagination(sessions, 8)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMyDoctorVideoSessions()
      setSessions(data.sessions)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar el panel de videoconsultas.'))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
      return
    }
    if (!authLoading && !user?.doctor_status) {
      navigate('/')
      return
    }
    if (isAuthenticated && user?.doctor_status) {
      loadSessions()
    }
  }, [authLoading, isAuthenticated, navigate, user, loadSessions])

  const openRoom = (session: DoctorVideoSession) => {
    sessionStorage.setItem(
      'sabiodoc-video-session',
      JSON.stringify({
        video_session_id: session.video_session_id,
        appointment_id: session.appointment_id ?? null,
        consultation_id: session.consultation_id,
        specialty_name: session.specialty_name,
        doctor_name: user?.email || 'Doctor',
        provider: session.provider,
        room_url: session.room_url,
        participant_token: session.doctor_token,
        participant_role: 'doctor',
        prepaid_amount_cents: session.prepaid_amount_cents,
        estimated_minutes: session.estimated_minutes,
        expires_at: session.expires_at,
      }),
    )
    navigate('/video-room')
  }

  return (
    <div className="space-y-6">
      <BackButton />

      <PageHeader
        title="Videoconsultas"
        description="Revisa las videoconsultas preparadas, activas o finalizadas y entra a la sala cuando corresponda."
        actions={
          <Button
            variant="secondary"
            onClick={loadSessions}
            disabled={loading}
            leftIcon={<RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Actualizar
          </Button>
        }
      />

      {authLoading || loading ? (
        <div className="space-y-4">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={Video}
          title="Sin videoconsultas registradas"
          description="Cuando se prepare o realice una videoconsulta, aparecerá aquí."
        />
      ) : (
        <div className="space-y-4">
          {pageItems.map((session) => (
            <div key={session.video_session_id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold text-slate-900">{session.specialty_name}</h2>
                    <Badge tone={VIDEO_SESSION_STATUS_TONES[session.status] ?? 'neutral'}>
                      {VIDEO_SESSION_STATUS_LABELS[session.status] || session.status}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <p className="inline-flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-primary-600" aria-hidden="true" />
                      Paciente:{' '}
                      <span className="font-medium text-slate-800">
                        {session.patient_name || session.patient_email}
                      </span>
                      {session.patient_name && <span className="text-slate-500"> · {session.patient_email}</span>}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-sky-600" aria-hidden="true" />
                      Expira: {new Date(session.expires_at).toLocaleString('es-ES')}
                    </p>
                    <p>Reserva estimada: {formatMoney(session.prepaid_amount_cents)}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 md:min-w-[230px]">
                  <Button onClick={() => openRoom(session)} leftIcon={<Video className="h-4 w-4" />}>
                    Entrar a la sala
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/doctor/patients/${session.patient_id}`)}
                    leftIcon={<FileText className="h-4 w-4" />}
                  >
                    Ver historial
                  </Button>
                  {session.room_url && (
                    <a
                      href={session.room_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1 text-center text-sm text-primary-600 hover:text-primary-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Abrir sala en pestaña nueva
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
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
