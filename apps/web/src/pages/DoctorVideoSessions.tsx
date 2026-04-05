import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock3, FileText, Loader2, Video, UserRound } from 'lucide-react'
import { getMyDoctorVideoSessions, DoctorVideoSession } from '../api/doctors'
import { useAuth } from '../context/AuthContext'
import BackButton from '../components/BackButton'

export default function DoctorVideoSessions() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [sessions, setSessions] = useState<DoctorVideoSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
      return
    }

    if (!authLoading && user?.role !== 'doctor') {
      navigate('/')
      return
    }

    const loadSessions = async () => {
      try {
        setError(null)
        const data = await getMyDoctorVideoSessions()
        setSessions(data.sessions)
      } catch (requestError: any) {
        console.error('Error loading doctor video sessions:', requestError)
        setError(requestError.response?.data?.detail || 'No se pudo cargar el panel de videoconsultas.')
      } finally {
        setLoading(false)
      }
    }

    if (isAuthenticated && user?.role === 'doctor') {
      loadSessions()
    }
  }, [authLoading, isAuthenticated, navigate, user])

  const formatMoney = (amountCents: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(amountCents / 100)

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
      })
    )
    navigate('/video-room')
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BackButton />
      <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">Videoconsultas</h1>
        <p className="mt-2 text-gray-600">
          Revisa las videoconsultas preparadas, activas o finalizadas y entra a la sala de Daily cuando corresponda.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <div className="rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-700">
            {sessions.length} sesiones visibles
          </div>
          <button
            onClick={() => {
              setLoading(true)
              void (async () => {
                try {
                  setError(null)
                  const data = await getMyDoctorVideoSessions()
                  setSessions(data.sessions)
                } catch (requestError: any) {
                  setError(requestError.response?.data?.detail || 'No se pudo refrescar la lista.')
                } finally {
                  setLoading(false)
                }
              })()
            }}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            Actualizar
          </button>
        </div>
        {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
      </section>

      {sessions.length === 0 ? (
        <div className="rounded-[32px] border border-dashed border-stone-200 bg-white py-16 text-center text-gray-500">
          No tienes videoconsultas registradas todavía.
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.video_session_id} className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold text-gray-900">{session.specialty_name}</h2>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700">
                      {session.status}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-gray-600">
                    <p className="inline-flex items-center gap-2">
                      <UserRound className="w-4 h-4 text-primary-600" />
                      Paciente: {session.patient_email}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <Clock3 className="w-4 h-4 text-sky-600" />
                      Expira: {new Date(session.expires_at).toLocaleString('es-ES')}
                    </p>
                    <p>Reserva estimada: {formatMoney(session.prepaid_amount_cents)}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 md:min-w-[230px]">
                  <button
                    onClick={() => openRoom(session)}
                    className="btn-primary inline-flex items-center justify-center gap-2"
                  >
                    <Video className="w-4 h-4" />
                    Entrar a la sala
                  </button>
                  <button
                    onClick={() => navigate(`/doctor/patients/${session.patient_id}`)}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50"
                  >
                    <FileText className="h-4 w-4" />
                    Ver historial
                  </button>
                  {session.room_url && (
                    <a
                      href={session.room_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-center text-sm text-primary-600 hover:text-primary-700"
                    >
                      Abrir room_url
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
