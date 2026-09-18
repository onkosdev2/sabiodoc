import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, FileText, Filter, MessageSquareText, Stethoscope, Video } from 'lucide-react'

import StructuredIntakeCard from '../components/StructuredIntakeCard'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import { DoctorPatientTimeline, DoctorPatientTimelineItem, getDoctorPatientTimeline } from '../api/doctors'
import { PatientProfile, getPatientProfile } from '../api/patients'
import { formatDateTime } from '../utils/format'
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONES,
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_STATUS_TONES,
  VIDEO_SESSION_STATUS_LABELS,
  VIDEO_SESSION_STATUS_TONES,
} from '../utils/statusLabels'

const itemTypeLabel: Record<DoctorPatientTimelineItem['item_type'], string> = {
  consultation: 'Preconsulta IA',
  appointment: 'Cita',
  video_session: 'Videoconsulta',
}

type ItemTypeFilter = 'all' | DoctorPatientTimelineItem['item_type']
type StatusFilter =
  | 'all'
  | 'created'
  | 'active'
  | 'closed'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'no_show'

const TYPE_FILTERS: Array<{ value: ItemTypeFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'consultation', label: 'Preconsulta IA' },
  { value: 'appointment', label: 'Cita' },
  { value: 'video_session', label: 'Videoconsulta' },
]

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'created', label: CONSULTATION_STATUS_LABELS.created },
  { value: 'active', label: CONSULTATION_STATUS_LABELS.active },
  { value: 'closed', label: CONSULTATION_STATUS_LABELS.closed },
  { value: 'scheduled', label: APPOINTMENT_STATUS_LABELS.scheduled },
  { value: 'completed', label: APPOINTMENT_STATUS_LABELS.completed },
  { value: 'cancelled', label: APPOINTMENT_STATUS_LABELS.cancelled },
  { value: 'no_show', label: APPOINTMENT_STATUS_LABELS.no_show },
]

export default function DoctorPatientTimelinePage() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const [timeline, setTimeline] = useState<DoctorPatientTimeline | null>(null)
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    const loadTimeline = async () => {
      if (!patientId) {
        setError('Paciente no especificado.')
        setLoading(false)
        return
      }

      try {
        const response = await getDoctorPatientTimeline(Number(patientId))
        setTimeline(response)
      } catch (requestError: any) {
        setError(requestError.response?.data?.detail || 'No se pudo cargar el historial del paciente.')
      } finally {
        setLoading(false)
      }

      // El perfil es opcional; si falla, no bloquea el historial.
      try {
        const profile = await getPatientProfile(Number(patientId))
        setPatientProfile(profile)
      } catch {
        setPatientProfile(null)
      }
    }

    loadTimeline()
  }, [patientId])

  const filteredItems = useMemo(() => {
    if (!timeline) {
      return []
    }

    return timeline.items.filter((item) => {
      const matchesType = itemTypeFilter === 'all' || item.item_type === itemTypeFilter
      const itemStatus = item.item_type === 'consultation' ? item.consultation_status : item.appointment_status
      const matchesStatus = statusFilter === 'all' || itemStatus === statusFilter
      return matchesType && matchesStatus
    })
  }, [itemTypeFilter, statusFilter, timeline])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    )
  }

  if (error || !timeline) {
    return (
      <Alert tone="danger" title="No se pudo abrir el historial">
        {error || 'No hay datos disponibles.'}
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-emerald-700">Paciente</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          {patientProfile?.full_name || timeline.patient_email}
        </h1>
        {patientProfile?.full_name && <p className="mt-1 text-sm text-slate-500">{timeline.patient_email}</p>}
        <p className="mt-2 text-slate-600">
          Historial longitudinal de preconsultas IA y videoconsultas vinculadas contigo.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => navigate(-1)} leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Volver
          </Button>
          <Badge tone="neutral">{timeline.total} eventos clínicos</Badge>
          <Badge tone="success">{filteredItems.length} tras filtros</Badge>
        </div>
      </section>

      {patientProfile && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Datos del paciente</h2>
          {profileDetails(patientProfile).length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">El paciente aún no ha completado su perfil.</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {profileDetails(patientProfile).map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-sm text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Filter className="h-5 w-5 text-slate-700" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-950">Filtros</h2>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tipo</p>
            <div role="tablist" aria-label="Filtrar por tipo" className="mt-3 inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1">
              {TYPE_FILTERS.map((option) => {
                const selected = itemTypeFilter === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setItemTypeFilter(option.value)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                      selected ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Estado</p>
            <div role="tablist" aria-label="Filtrar por estado" className="mt-3 flex flex-wrap gap-2">
              {STATUS_FILTERS.map((option) => {
                const selected = statusFilter === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setStatusFilter(option.value)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      selected ? 'bg-emerald-700 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {filteredItems.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin eventos clínicos"
          description="No hay eventos que coincidan con los filtros actuales."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setItemTypeFilter('all')
                setStatusFilter('all')
              }}
            >
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <article
              key={`${item.item_type}-${item.consultation_id ?? item.appointment_id}`}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge
                      tone={
                        item.item_type === 'consultation'
                          ? 'primary'
                          : item.item_type === 'appointment'
                            ? 'info'
                            : 'success'
                      }
                    >
                      {itemTypeLabel[item.item_type]}
                    </Badge>
                    <span className="text-sm text-slate-500">{item.specialty_name}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">{formatDateTime(item.sort_at)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.consultation_status && (
                    <Badge tone={CONSULTATION_STATUS_TONES[item.consultation_status] ?? 'neutral'}>
                      {CONSULTATION_STATUS_LABELS[item.consultation_status] ?? item.consultation_status}
                    </Badge>
                  )}
                  {item.appointment_status && (
                    <Badge tone={APPOINTMENT_STATUS_TONES[item.appointment_status] ?? 'neutral'}>
                      {APPOINTMENT_STATUS_LABELS[item.appointment_status] ?? item.appointment_status}
                    </Badge>
                  )}
                  {item.video_session_status && (
                    <Badge tone={VIDEO_SESSION_STATUS_TONES[item.video_session_status] ?? 'neutral'}>
                      {VIDEO_SESSION_STATUS_LABELS[item.video_session_status] ?? item.video_session_status}
                    </Badge>
                  )}
                </div>
              </div>

              {item.summary && (
                <div className="mt-5 rounded-2xl bg-primary-50 p-4">
                  <div className="flex items-center gap-2 text-primary-700">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    <p className="text-xs uppercase tracking-[0.22em]">Resumen clínico</p>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-primary-950">{item.summary}</p>
                </div>
              )}

              {item.intake && <StructuredIntakeCard intake={item.intake} title="Ficha estructurada" className="mt-4" />}

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {item.patient_note && (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-slate-700">
                      <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                      <p className="text-xs uppercase tracking-[0.22em]">Nota del paciente</p>
                    </div>
                    <p className="mt-3 text-sm text-slate-900">{item.patient_note}</p>
                  </div>
                )}

                {item.doctor_note && (
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Stethoscope className="h-4 w-4" aria-hidden="true" />
                      <p className="text-xs uppercase tracking-[0.22em]">Nota médica</p>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-emerald-950">{item.doctor_note}</p>
                  </div>
                )}

                {item.followup_instructions && (
                  <div className="rounded-2xl bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Video className="h-4 w-4" aria-hidden="true" />
                      <p className="text-xs uppercase tracking-[0.22em]">Indicaciones</p>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-amber-950">{item.followup_instructions}</p>
                  </div>
                )}

                {(item.scheduled_at || item.completed_at) && (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-slate-700">
                      <CalendarClock className="h-4 w-4" aria-hidden="true" />
                      <p className="text-xs uppercase tracking-[0.22em]">Tiempos</p>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-900">
                      {item.scheduled_at && <p>Agendada: {formatDateTime(item.scheduled_at)}</p>}
                      {item.completed_at && <p>Completada: {formatDateTime(item.completed_at)}</p>}
                    </div>
                  </div>
                )}
              </div>

              {(item.review_rating || item.review_comment) && (
                <div className="mt-4 rounded-2xl bg-violet-50 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-violet-700">Feedback del paciente</p>
                  <p className="mt-3 text-sm text-violet-950">
                    {item.review_rating ? `Valoración: ${item.review_rating}/5` : 'Sin valoración'}
                  </p>
                  {item.review_comment && <p className="mt-2 text-sm text-violet-900">{item.review_comment}</p>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function profileDetails(profile: PatientProfile): Array<{ label: string; value: string }> {
  const items: Array<{ label: string; value: string }> = []
  const add = (label: string, value?: string | number | null) => {
    if (value !== null && value !== undefined && `${value}`.trim() !== '') {
      items.push({ label, value: `${value}` })
    }
  }

  add('Nombre', profile.full_name)
  add('Edad', profile.age != null ? `${profile.age} años` : null)
  add(
    'Sexo',
    profile.sex === 'male' ? 'Masculino' : profile.sex === 'female' ? 'Femenino' : profile.sex === 'other' ? 'Otro' : null,
  )
  add('Teléfono', profile.phone)
  add('Ubicación', [profile.city, profile.country].filter(Boolean).join(', '))
  add('Grupo sanguíneo', profile.blood_type)
  add('Alergias', profile.allergies)
  add('Enfermedades crónicas', profile.chronic_conditions)
  add('Medicación actual', profile.current_medications)
  add('Antecedentes familiares', profile.family_history)
  add('Altura', profile.height_cm != null ? `${profile.height_cm} cm` : null)
  add('Peso', profile.weight_kg != null ? `${profile.weight_kg} kg` : null)
  add('Fuma', profile.smoker === true ? 'Sí' : profile.smoker === false ? 'No' : null)
  add('Alcohol', profile.alcohol === true ? 'Sí' : profile.alcohol === false ? 'No' : null)
  add(
    'Contacto de emergencia',
    [profile.emergency_contact_name, profile.emergency_contact_phone].filter(Boolean).join(' · '),
  )
  add('Notas', profile.notes)

  return items
}
