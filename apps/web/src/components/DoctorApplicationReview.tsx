import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCcw, Search, ShieldCheck } from 'lucide-react'

import { DoctorApplication, getDoctorApplications, updateDoctorApplicationStatus } from '../api/doctors'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import Badge from './ui/Badge'
import type { BadgeTone } from './ui/Badge'
import Button from './ui/Button'
import EmptyState from './ui/EmptyState'
import Skeleton from './ui/Skeleton'
import { Textarea } from './ui/Field'

const STATUS_OPTIONS = ['all', 'pending', 'approved', 'rejected', 'suspended'] as const

type FilterStatus = (typeof STATUS_OPTIONS)[number]

const STATUS_LABELS: Record<FilterStatus, string> = {
  all: 'Todos',
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  suspended: 'Suspendido',
}

const STATUS_TONES: Record<Exclude<FilterStatus, 'all'>, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'neutral',
}

const currency = (cents: number) => `US$ ${(cents / 100).toFixed(2)} / min`

interface DoctorApplicationReviewProps {
  eyebrow: string
  title: string
  description: string
}

/**
 * Panel reutilizable para revisar postulaciones médicas y aprobarlas,
 * rechazarlas o suspenderlas. Lo usan tanto el panel admin como el de revisores.
 */
export default function DoctorApplicationReview({ eyebrow, title, description }: DoctorApplicationReviewProps) {
  const toast = useToast()
  const [filter, setFilter] = useState<FilterStatus>('pending')
  const [applications, setApplications] = useState<DoctorApplication[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadApplications = useCallback(
    async (nextFilter: FilterStatus) => {
      setLoading(true)
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
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudieron cargar las postulaciones'))
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    loadApplications(filter)
  }, [filter, loadApplications])

  const selectedApplication = useMemo(
    () => applications.find((item) => item.doctor_id === selectedId) || null,
    [applications, selectedId],
  )

  const filteredApplications = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return applications
    return applications.filter(
      (application) =>
        application.display_name.toLowerCase().includes(term) ||
        (application.email || '').toLowerCase().includes(term),
    )
  }, [applications, search])

  useEffect(() => {
    if (selectedApplication) {
      setReviewNotes(selectedApplication.review_notes || '')
    }
  }, [selectedApplication])

  const handleReview = async (status: 'approved' | 'rejected' | 'suspended') => {
    if (!selectedApplication) return
    setSaving(true)
    try {
      const updated = await updateDoctorApplicationStatus(selectedApplication.doctor_id, {
        status,
        review_notes: reviewNotes.trim() || undefined,
      })
      setApplications((current) => current.map((item) => (item.doctor_id === updated.doctor_id ? updated : item)))
      setSelectedId(updated.doctor_id)
      setReviewNotes(updated.review_notes || '')
      toast.success(`Postulación ${STATUS_LABELS[status].toLowerCase()}.`)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar la postulación'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sky-700">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">{title}</h1>
            <p className="mt-2 max-w-3xl text-slate-600">{description}</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => loadApplications(filter)}
            disabled={loading}
            leftIcon={<RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Recargar
          </Button>
        </div>

        <div role="tablist" aria-label="Filtrar postulaciones" className="mt-6 inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1">
          {STATUS_OPTIONS.map((status) => {
            const selected = filter === status
            return (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(status)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  selected ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            )
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)] xl:self-start">
          <div className="mb-3 flex-none">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                aria-label="Buscar postulación por nombre o email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre o email..."
                className="input-field pl-10"
              />
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
              {filteredApplications.length} postulación(es)
            </p>
          </div>

          <div className="min-h-0 flex-1 xl:overflow-y-auto xl:pr-1">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-28 w-full rounded-2xl" />
                ))}
              </div>
            ) : filteredApplications.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title={applications.length === 0 ? 'Sin postulaciones' : 'Sin coincidencias'}
                description={
                  applications.length === 0
                    ? 'No hay postulaciones para este filtro.'
                    : 'Prueba con otro término de búsqueda.'
                }
              />
            ) : (
              <div className="space-y-3">
                {filteredApplications.map((application) => (
                  <button
                    key={application.doctor_id}
                    type="button"
                    onClick={() => setSelectedId(application.doctor_id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      selectedId === application.doctor_id
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-slate-200 bg-white hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold text-slate-950">{application.display_name}</p>
                        <p className="mt-1 truncate text-sm text-slate-600">
                          {application.professional_title || 'Profesional médico'}
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-500">{application.email}</p>
                      </div>
                      <Badge tone={STATUS_TONES[application.status]} className="flex-none whitespace-nowrap">
                        {STATUS_LABELS[application.status]}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {application.specialties.map((specialty) => (
                        <Badge key={specialty.id} tone="neutral">
                          {specialty.name}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-4 text-sm text-slate-700">{currency(application.price_per_min_cents)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {!selectedApplication ? (
            <EmptyState
              icon={ShieldCheck}
              title="Selecciona una postulación"
              description="Elige una solicitud de la lista para revisar sus datos y decidir."
            />
          ) : (
            <div className="space-y-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.28em] text-sky-700">Solicitud</p>
                  <h2 className="mt-2 break-words text-3xl font-bold text-slate-950">
                    {selectedApplication.display_name}
                  </h2>
                  <p className="mt-2 break-words text-slate-600">{selectedApplication.professional_title}</p>
                </div>
                <Badge tone={STATUS_TONES[selectedApplication.status]} className="self-start">
                  Estado: {STATUS_LABELS[selectedApplication.status]}
                </Badge>
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
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Especialidades</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedApplication.specialties.map((specialty) => (
                    <Badge key={specialty.id} tone="info">
                      {specialty.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Descripción clínica</p>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700">
                  {selectedApplication.bio_short || 'Sin descripción.'}
                </div>
              </div>

              <Textarea
                label="Notas de revisión"
                value={reviewNotes}
                onChange={(event) => setReviewNotes(event.target.value)}
                className="min-h-32"
                placeholder="Observaciones internas, motivo de rechazo, condiciones para aprobación, etc."
              />

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => handleReview('approved')}
                  disabled={saving || selectedApplication.status === 'approved'}
                  loading={saving}
                  className="min-w-[140px] flex-1 bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500"
                >
                  Aprobar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleReview('rejected')}
                  disabled={saving || selectedApplication.status === 'rejected'}
                  className="min-w-[140px] flex-1 text-red-700 hover:bg-red-50"
                >
                  Rechazar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleReview('suspended')}
                  disabled={saving || selectedApplication.status === 'suspended'}
                  className="min-w-[140px] flex-1 text-amber-700 hover:bg-amber-50"
                >
                  Suspender
                </Button>
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}
