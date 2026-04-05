import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Loader2, ShieldAlert } from 'lucide-react'

import { getMyDoctorApplication, DoctorApplication } from '../api/doctors'
import { useAuth } from '../context/AuthContext'

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
        const requestError = err as { response?: { data?: { detail?: string } } }
        if (mounted) {
          setError(requestError.response?.data?.detail || 'No se pudo cargar tu postulacion médica')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    if (!authLoading && isAuthenticated && user?.role === 'doctor') {
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
  }, [authLoading, isAuthenticated, user?.role, refreshUser])

  if (!authLoading && (!isAuthenticated || user?.role !== 'doctor')) {
    return <Navigate to="/login" replace />
  }

  if (!authLoading && user?.doctor_status === 'approved') {
    return <Navigate to="/doctor" replace />
  }

  return (
    <div className="mx-auto max-w-2xl rounded-[32px] border border-amber-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
        <ShieldAlert className="h-10 w-10 text-amber-600" />
      </div>
      <h1 className="mt-6 text-3xl font-bold text-stone-900">Perfil médico en revisión</h1>
      <p className="mt-3 text-stone-600">
        Tu acceso al panel médico está pendiente de aprobación por parte de SabioDoc. Cuando tu perfil sea aprobado,
        aquí verás tus videoconsultas, disponibilidad y herramientas clínicas.
      </p>

      {loading ? (
        <div className="mt-8 flex items-center justify-center text-stone-500">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Verificando tu estado...
        </div>
      ) : error ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      ) : application ? (
        <div className="mt-8 rounded-3xl border border-stone-200 bg-stone-50 p-6 text-left">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Perfil</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">{application.display_name}</p>
              <p className="mt-1 text-sm text-stone-600">{application.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Tarifa enviada</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                US$ {(application.price_per_min_cents / 100).toFixed(2)} / min
              </p>
              <p className="mt-1 text-sm text-stone-600">Estado actual: {application.status}</p>
              <p className="mt-1 text-sm text-stone-600">Zona horaria: {application.timezone || 'UTC'}</p>
            </div>
          </div>

          {application.bio_short && (
            <div className="mt-5">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Descripción</p>
              <p className="mt-2 text-sm leading-6 text-stone-700">{application.bio_short}</p>
            </div>
          )}

          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Especialidades declaradas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {application.specialties.map((specialty) => (
                <span key={specialty.id} className="rounded-full bg-stone-900 px-3 py-1 text-sm text-stone-100">
                  {specialty.name}
                </span>
              ))}
            </div>
          </div>

          {application.review_notes && (
            <div className="mt-5">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Notas de revisión</p>
              <p className="mt-2 text-sm leading-6 text-stone-700">{application.review_notes}</p>
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link to="/doctor/apply" className="btn-primary inline-flex">
          Completar o actualizar perfil
        </Link>
        <Link to="/" className="inline-flex rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-700 transition-colors hover:border-stone-900 hover:text-stone-950">
          Volver al portal general
        </Link>
      </div>
    </div>
  )
}
