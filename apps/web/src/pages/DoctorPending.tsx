import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'

import { getMyDoctorApplication, DoctorApplication } from '../api/doctors'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../utils/apiError'
import { DOCTOR_APPLICATION_STATUS_LABELS } from '../utils/statusLabels'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'

export default function DoctorPending() {
  const { user, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth()
  const [application, setApplication] = useState<DoctorApplication | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadApplication = async () => {
      try {
        const refreshed = await refreshUser()
        if (!mounted) {
          return
        }
        if (refreshed?.doctor_status === 'approved') {
          setLoading(false)
          return
        }

        const response = await getMyDoctorApplication()
        if (mounted) {
          setApplication(response)
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(getApiErrorMessage(err, 'No se pudo cargar tu postulación médica'))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    if (!authLoading && isAuthenticated && user?.doctor_status) {
      loadApplication()
      const intervalId = window.setInterval(loadApplication, 10000)
      return () => {
        mounted = false
        window.clearInterval(intervalId)
      }
    } else if (!authLoading) {
      setLoading(false)
    }

    return () => {
      mounted = false
    }
  }, [authLoading, isAuthenticated, user?.doctor_status, refreshUser])

  if (!authLoading && (!isAuthenticated || !user?.doctor_status)) {
    return <Navigate to="/login" replace />
  }

  if (!authLoading && user?.doctor_status === 'approved') {
    return <Navigate to="/doctor" replace />
  }

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
        <ShieldAlert className="h-10 w-10 text-amber-600" />
      </div>
      <h1 className="mt-6 text-3xl font-bold text-slate-900">Perfil médico en revisión</h1>
      <p className="mt-3 text-slate-600">
        Tu acceso al panel médico está pendiente de aprobación por parte de SabioDoc. Cuando tu perfil sea aprobado,
        aquí verás tus videoconsultas, disponibilidad y herramientas clínicas.
      </p>

      {loading ? (
        <div className="mt-8 flex items-center justify-center text-slate-500">
          <Spinner className="mr-3" />
          Verificando tu estado...
        </div>
      ) : error ? (
        <Alert tone="danger" className="mt-8">
          {error}
        </Alert>
      ) : application ? (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-left">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Perfil</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{application.display_name}</p>
              <p className="mt-1 text-sm text-slate-600">{application.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tarifa enviada</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                US$ {(application.price_per_min_cents / 100).toFixed(2)} / min
              </p>
              <p className="mt-1 text-sm text-slate-600">Estado actual: {DOCTOR_APPLICATION_STATUS_LABELS[application.status] || application.status}</p>
              <p className="mt-1 text-sm text-slate-600">Zona horaria: {application.timezone || 'UTC'}</p>
            </div>
          </div>

          {application.bio_short && (
            <div className="mt-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Descripción</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{application.bio_short}</p>
            </div>
          )}

          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Especialidades declaradas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {application.specialties.map((specialty) => (
                <Badge key={specialty.id} tone="neutral">
                  {specialty.name}
                </Badge>
              ))}
            </div>
          </div>

          {application.review_notes && (
            <div className="mt-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Notas de revisión</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{application.review_notes}</p>
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link to="/doctor/apply" className="btn-primary inline-flex">
          Completar o actualizar perfil
        </Link>
        <Link to="/" className="inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-950">
          Volver al portal general
        </Link>
      </div>
    </div>
  )
}
