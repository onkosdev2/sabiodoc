import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'

import {
  DoctorApplication,
  getDoctorApplications,
  updateDoctorApplicationStatus,
} from '../api/doctors'

const STATUS_OPTIONS = ['all', 'pending', 'approved', 'rejected', 'suspended'] as const

type FilterStatus = typeof STATUS_OPTIONS[number]

const currency = (cents: number) => `US$ ${(cents / 100).toFixed(2)} / min`

interface DoctorApplicationReviewProps {
  eyebrow: string
  title: string
  description: string
}

/**
 * Panel reutilizable para revisar postulaciones medicas y aprobarlas,
 * rechazarlas o suspenderlas. Lo usan tanto el panel admin como el de revisores.
 */
export default function DoctorApplicationReview({ eyebrow, title, description }: DoctorApplicationReviewProps) {
  const [filter, setFilter] = useState<FilterStatus>('pending')
  const [applications, setApplications] = useState<DoctorApplication[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadApplications = useCallback(async (nextFilter: FilterStatus) => {
    setLoading(true)
    setError(null)
    try {
      const response = await getDoctorApplications(nextFilter === 'all' ? undefined : nextFilter)
      setApplications(response.applications)
      if (response.applications.length > 0) {
        setSelectedId((currentSelectedId) => {
          const current = response.applications.find((item) => item.doctor_id === currentSelectedId)
          const target = current || response.applications[0]
          setReviewNotes(target.review_notes || '')
          return target.doctor_id
        })
      } else {
        setSelectedId(null)
        setReviewNotes('')
      }
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { detail?: string } } }
      setError(requestError.response?.data?.detail || 'No se pudieron cargar las postulaciones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadApplications(filter)
  }, [filter, loadApplications])

  const selectedApplication = useMemo(
    () => applications.find((item) => item.doctor_id === selectedId) || null,
    [applications, selectedId]
  )

  useEffect(() => {
    if (selectedApplication) {
      setReviewNotes(selectedApplication.review_notes || '')
    }
  }, [selectedApplication])

  const handleReview = async (status: 'approved' | 'rejected' | 'suspended') => {
    if (!selectedApplication) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await updateDoctorApplicationStatus(selectedApplication.doctor_id, {
        status,
        review_notes: reviewNotes.trim() || undefined,
      })
      setApplications((current) =>
        current.map((item) => (item.doctor_id === updated.doctor_id ? updated : item))
      )
      setSelectedId(updated.doctor_id)
      setReviewNotes(updated.review_notes || '')
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { detail?: string } } }
      setError(requestError.response?.data?.detail || 'No se pudo actualizar la postulación')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sky-700">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-bold text-stone-950">{title}</h1>
            <p className="mt-2 max-w-3xl text-stone-600">{description}</p>
          </div>
          <button
            onClick={() => loadApplications(filter)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:border-stone-900 hover:text-stone-950"
          >
            <RefreshCcw className="h-4 w-4" />
            Recargar
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-stone-950 text-white'
                  : 'border border-stone-300 bg-white text-stone-700 hover:border-stone-900'
              }`}
            >
              {status === 'all' ? 'Todos' : status}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-[32px] border border-stone-200 bg-white p-4 shadow-sm">
          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center text-stone-500">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              Cargando postulaciones...
            </div>
          ) : applications.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone-200 px-6 py-12 text-center text-stone-500">
              No hay postulaciones para este filtro.
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((application) => (
                <button
                  key={application.doctor_id}
                  onClick={() => setSelectedId(application.doctor_id)}
                  className={`w-full rounded-3xl border p-4 text-left transition-colors ${
                    selectedId === application.doctor_id
                      ? 'border-sky-500 bg-sky-50'
                      : 'border-stone-200 bg-white hover:border-stone-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-stone-950">{application.display_name}</p>
                      <p className="mt-1 text-sm text-stone-600">{application.professional_title || 'Profesional médico'}</p>
                      <p className="mt-1 text-sm text-stone-500">{application.email}</p>
                    </div>
                    <span className="rounded-full bg-stone-950 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-white">
                      {application.status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {application.specialties.map((specialty) => (
                      <span key={specialty.id} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                        {specialty.name}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-stone-700">{currency(application.price_per_min_cents)}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
          {!selectedApplication ? (
            <div className="flex min-h-[320px] items-center justify-center text-stone-500">
              Selecciona una postulación para revisarla.
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-sky-700">Solicitud</p>
                  <h2 className="mt-2 text-3xl font-bold text-stone-950">{selectedApplication.display_name}</h2>
                  <p className="mt-2 text-stone-600">{selectedApplication.professional_title}</p>
                </div>
                <div className="rounded-3xl bg-stone-950 px-4 py-3 text-sm text-stone-100">
                  Estado actual: <strong>{selectedApplication.status}</strong>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoBlock label="Email" value={selectedApplication.email} />
                <InfoBlock label="Tarifa" value={currency(selectedApplication.price_per_min_cents)} />
                <InfoBlock label="Licencia" value={selectedApplication.license_number || '-'} />
                <InfoBlock label="País de licencia" value={selectedApplication.license_country || '-'} />
                <InfoBlock label="Ciudad" value={selectedApplication.city || '-'} />
                <InfoBlock label="País" value={selectedApplication.country || '-'} />
                <InfoBlock label="Documento" value={selectedApplication.government_id || '-'} />
                <InfoBlock label="Experiencia" value={`${selectedApplication.years_experience ?? 0} años`} />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Especialidades</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedApplication.specialties.map((specialty) => (
                    <span key={specialty.id} className="rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-800">
                      {specialty.name}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Descripción clínica</p>
                <div className="mt-3 rounded-3xl border border-stone-200 bg-stone-50 p-5 text-sm leading-6 text-stone-700">
                  {selectedApplication.bio_short || 'Sin descripción.'}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.22em] text-stone-500">Notas de revisión</label>
                <textarea
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  className="input-field mt-3 min-h-32"
                  placeholder="Observaciones internas, motivo de rechazo, condiciones para aprobación, etc."
                />
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <button
                  onClick={() => handleReview('approved')}
                  disabled={saving || selectedApplication.status === 'approved'}
                  className="btn-primary inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Aprobar'}
                </button>
                <button
                  onClick={() => handleReview('rejected')}
                  disabled={saving || selectedApplication.status === 'rejected'}
                  className="inline-flex items-center justify-center rounded-full border border-red-300 px-5 py-3 text-sm font-medium text-red-700 transition-colors hover:border-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Rechazar
                </button>
                <button
                  onClick={() => handleReview('suspended')}
                  disabled={saving || selectedApplication.status === 'suspended'}
                  className="inline-flex items-center justify-center rounded-full border border-amber-300 px-5 py-3 text-sm font-medium text-amber-700 transition-colors hover:border-amber-500 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Suspender
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-stone-900">{value}</p>
    </div>
  )
}
