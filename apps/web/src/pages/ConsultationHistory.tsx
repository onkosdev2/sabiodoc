import { useEffect, useState } from 'react'
import { BookOpenText, ChevronDown, Inbox, MessageSquare } from 'lucide-react'

import { getConsultationHistory, ConsultationHistoryItem, ConsultationSource } from '../api/history'
import TriageResultCard from '../components/TriageResultCard'
import BackButton from '../components/BackButton'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import type { BadgeTone } from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/Pagination'
import Skeleton from '../components/ui/Skeleton'
import { getApiErrorMessage } from '../utils/apiError'
import { usePagination } from '../hooks/usePagination'

type FilterValue = 'all' | ConsultationSource

const URGENCY_TONES: Record<string, BadgeTone> = {
  low: 'success',
  medium: 'info',
  high: 'warning',
  emergency: 'danger',
}

const URGENCY_LABELS: Record<string, string> = {
  low: 'Urgencia baja',
  medium: 'Urgencia media',
  high: 'Urgencia alta',
  emergency: 'Emergencia',
}

const SOURCE_CONFIG: Record<ConsultationSource, { label: string; icon: typeof MessageSquare; tone: BadgeTone }> = {
  triage: { label: 'Describir Mi Caso', icon: MessageSquare, tone: 'success' },
  guide: { label: 'Guía de Especialidades', icon: BookOpenText, tone: 'primary' },
}

export default function ConsultationHistory() {
  const [items, setItems] = useState<ConsultationHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterValue>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getConsultationHistory()
        setItems(data)
      } catch (err) {
        setError(getApiErrorMessage(err, 'No pudimos cargar tu historial de orientaciones.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = filter === 'all' ? items : items.filter((item) => item.source === filter)
  const { page, setPage, pageItems, totalPages, totalItems, pageSize } = usePagination(filtered, 8, filter)

  const filters: { value: FilterValue; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'triage', label: 'Describir Mi Caso' },
    { value: 'guide', label: 'Guía de Especialidades' },
  ]

  return (
    <div className="mx-auto max-w-3xl pb-12">
      <BackButton />

      <PageHeader
        icon={Inbox}
        title="Historial de orientaciones"
        description="Revisa las consultas que te dio la IA, tanto en 'Describir Mi Caso' como en la Guía de Especialidades."
        className="mb-6"
      />

      <div role="tablist" aria-label="Filtrar por origen" className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {filters.map((option) => {
          const selected = filter === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(option.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                selected ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={items.length === 0 ? 'Aún no tienes orientaciones' : 'Sin resultados para este filtro'}
          description={
            items.length === 0
              ? 'Cuando uses "Describir Mi Caso" o la Guía de Especialidades, verás aquí el historial.'
              : 'Prueba con otro filtro para ver tus orientaciones.'
          }
        />
      ) : (
        <div className="space-y-4">
          {pageItems.map((item) => {
            const config = SOURCE_CONFIG[item.source] ?? SOURCE_CONFIG.triage
            const Icon = config.icon
            const isExpanded = expandedId === item.id

            return (
              <div key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  aria-expanded={isExpanded}
                  className="w-full p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge tone={config.tone} icon={<Icon className="h-3.5 w-3.5" aria-hidden="true" />}>
                          {config.label}
                        </Badge>
                        <Badge tone={URGENCY_TONES[item.result.urgency] ?? 'info'}>
                          {URGENCY_LABELS[item.result.urgency] ?? 'Urgencia media'}
                        </Badge>
                      </div>
                      <p className="font-medium capitalize text-slate-800">
                        {item.result.recommended_specialty_slug.replace(/-/g, ' ')}
                      </p>
                      {item.summary && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.summary}</p>}
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(item.created_at).toLocaleString('es-ES')}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 p-4">
                    <TriageResultCard result={item.result} />
                  </div>
                )}
              </div>
            )
          })}
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
