import { useEffect, useState } from 'react'
import { Loader2, MessageSquare, BookOpenText, ChevronDown, ChevronUp, Inbox } from 'lucide-react'
import {
  getConsultationHistory,
  ConsultationHistoryItem,
  ConsultationSource,
} from '../api/history'
import TriageResultCard from '../components/TriageResultCard'
import BackButton from '../components/BackButton'

type FilterValue = 'all' | ConsultationSource

const urgencyBadge: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  emergency: 'bg-red-100 text-red-700',
}

const urgencyLabel: Record<string, string> = {
  low: 'Urgencia baja',
  medium: 'Urgencia media',
  high: 'Urgencia alta',
  emergency: '⚠️ Emergencia',
}

const sourceConfig: Record<
  ConsultationSource,
  { label: string; icon: typeof MessageSquare; className: string }
> = {
  triage: {
    label: 'Describir Mi Caso',
    icon: MessageSquare,
    className: 'bg-green-100 text-green-700',
  },
  guide: {
    label: 'Guía de Especialidades',
    icon: BookOpenText,
    className: 'bg-purple-100 text-purple-700',
  },
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
        console.error('Error cargando historial:', err)
        setError('No pudimos cargar tu historial de orientaciones.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = filter === 'all' ? items : items.filter((item) => item.source === filter)

  const filters: { value: FilterValue; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'triage', label: 'Describir Mi Caso' },
    { value: 'guide', label: 'Guía de Especialidades' },
  ]

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <BackButton />

      <h1 className="text-3xl font-bold text-gray-800 mb-2">📋 Historial de Orientaciones</h1>
      <p className="text-gray-600 mb-6">
        Revisa las consultas que te dio la IA, tanto en "Describir Mi Caso" como en la
        Guía de Especialidades.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === option.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center text-center py-12">
          <Inbox className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-600">
            {items.length === 0
              ? 'Aún no tienes consultas de orientación con IA.'
              : 'No hay consultas para este filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const config = sourceConfig[item.source] ?? sourceConfig.triage
            const Icon = config.icon
            const isExpanded = expandedId === item.id

            return (
              <div key={item.id} className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${config.className}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {config.label}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            urgencyBadge[item.result.urgency] ?? urgencyBadge.medium
                          }`}
                        >
                          {urgencyLabel[item.result.urgency] ?? 'Urgencia media'}
                        </span>
                      </div>
                      <p className="text-gray-800 font-medium capitalize">
                        {item.result.recommended_specialty_slug.replace(/-/g, ' ')}
                      </p>
                      {item.summary && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.summary}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 pt-0">
                    <TriageResultCard result={item.result} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
