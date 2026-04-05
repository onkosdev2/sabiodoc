import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarClock, FileText, Filter, Loader2, MessageSquareText, Stethoscope, Video } from 'lucide-react'

import StructuredIntakeCard from '../components/StructuredIntakeCard'
import { DoctorPatientTimeline, DoctorPatientTimelineItem, getDoctorPatientTimeline } from '../api/doctors'

const itemTypeLabel: Record<DoctorPatientTimelineItem['item_type'], string> = {
  consultation: 'Preconsulta IA',
  appointment: 'Videoconsulta',
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

export default function DoctorPatientTimelinePage() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const [timeline, setTimeline] = useState<DoctorPatientTimeline | null>(null)
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
      <div className="flex items-center justify-center py-20 text-stone-500">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Cargando historial del paciente...
      </div>
    )
  }

  if (error || !timeline) {
    return (
      <div className="rounded-[32px] border border-rose-200 bg-rose-50 p-8 text-rose-800">
        <p className="text-lg font-semibold">No se pudo abrir el historial</p>
        <p className="mt-2 text-sm">{error || 'No hay datos disponibles.'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-emerald-700">Paciente</p>
        <h1 className="mt-2 text-3xl font-bold text-stone-950">{timeline.patient_email}</h1>
        <p className="mt-2 text-stone-600">
          Historial longitudinal de preconsultas IA y videoconsultas vinculadas contigo.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Volver
          </button>
          <div className="rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-700">
            {timeline.total} eventos clínicos visibles
          </div>
          <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
            {filteredItems.length} tras filtros
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Filter className="h-5 w-5 text-stone-700" />
          <h2 className="text-lg font-semibold text-stone-950">Filtros</h2>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Tipo</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'Todos' },
                { value: 'consultation', label: 'Preconsulta IA' },
                { value: 'appointment', label: 'Videoconsulta' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setItemTypeFilter(option.value as ItemTypeFilter)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    itemTypeFilter === option.value
                      ? 'bg-stone-950 text-white'
                      : 'border border-stone-300 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Estado</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'Todos' },
                { value: 'created', label: 'Creada' },
                { value: 'active', label: 'Activa' },
                { value: 'closed', label: 'Cerrada' },
                { value: 'scheduled', label: 'Programada' },
                { value: 'completed', label: 'Completada' },
                { value: 'cancelled', label: 'Cancelada' },
                { value: 'no_show', label: 'No-show' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setStatusFilter(option.value as StatusFilter)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    statusFilter === option.value
                      ? 'bg-emerald-700 text-white'
                      : 'border border-stone-300 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {filteredItems.length === 0 ? (
        <div className="rounded-[32px] border border-dashed border-stone-200 bg-white px-6 py-16 text-center text-stone-500">
          No hay eventos clínicos que coincidan con los filtros actuales.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <article key={`${item.item_type}-${item.consultation_id ?? item.appointment_id}`} className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-stone-950 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white">
                      {itemTypeLabel[item.item_type]}
                    </span>
                    <span className="text-sm text-stone-500">{item.specialty_name}</span>
                  </div>
                  <p className="mt-3 text-sm text-stone-500">
                    {new Date(item.sort_at).toLocaleString('es-ES')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-stone-500">
                  {item.consultation_status && <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">{item.consultation_status}</span>}
                  {item.appointment_status && <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{item.appointment_status}</span>}
                </div>
              </div>

              {item.summary && (
                <div className="mt-5 rounded-2xl bg-blue-50 p-4">
                  <div className="flex items-center gap-2 text-blue-700">
                    <FileText className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-[0.22em]">Resumen clínico</p>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-blue-950">{item.summary}</p>
                </div>
              )}

              {item.intake && (
                <StructuredIntakeCard intake={item.intake} title="Ficha estructurada" className="mt-4" />
              )}

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {item.patient_note && (
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <div className="flex items-center gap-2 text-stone-700">
                      <MessageSquareText className="h-4 w-4" />
                      <p className="text-xs uppercase tracking-[0.22em]">Nota del paciente</p>
                    </div>
                    <p className="mt-3 text-sm text-stone-900">{item.patient_note}</p>
                  </div>
                )}

                {item.doctor_note && (
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Stethoscope className="h-4 w-4" />
                      <p className="text-xs uppercase tracking-[0.22em]">Nota médica</p>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-emerald-950">{item.doctor_note}</p>
                  </div>
                )}

                {item.followup_instructions && (
                  <div className="rounded-2xl bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Video className="h-4 w-4" />
                      <p className="text-xs uppercase tracking-[0.22em]">Indicaciones</p>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-amber-950">{item.followup_instructions}</p>
                  </div>
                )}

                {(item.scheduled_at || item.completed_at) && (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-slate-700">
                      <CalendarClock className="h-4 w-4" />
                      <p className="text-xs uppercase tracking-[0.22em]">Tiempos</p>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-900">
                      {item.scheduled_at && <p>Agendada: {new Date(item.scheduled_at).toLocaleString('es-ES')}</p>}
                      {item.completed_at && <p>Completada: {new Date(item.completed_at).toLocaleString('es-ES')}</p>}
                    </div>
                  </div>
                )}
              </div>

              {(item.review_rating || item.review_comment) && (
                <div className="mt-4 rounded-2xl bg-purple-50 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-purple-700">Feedback del paciente</p>
                  <p className="mt-3 text-sm text-purple-950">
                    {item.review_rating ? `Rating: ${item.review_rating}/5` : 'Sin rating'}
                  </p>
                  {item.review_comment && <p className="mt-2 text-sm text-purple-900">{item.review_comment}</p>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
