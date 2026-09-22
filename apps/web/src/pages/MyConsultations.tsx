import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  MessageCircle,
  Play,
  Plus,
  Trash2,
  Video,
} from 'lucide-react'

import {
  closeConsultation,
  deleteConsultation,
  getMyConsultations,
  Consultation,
} from '../api/consultations'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import BackButton from '../components/BackButton'
import ConfirmDialog from '../components/ConfirmDialog'
import Pagination from '../components/Pagination'
import RichText from '../components/RichText'
import StructuredIntakeCard from '../components/StructuredIntakeCard'
import SummaryToggleButton from '../components/SummaryToggleButton'
import Skeleton from '../components/ui/Skeleton'
import { formatRelativeTime } from '../utils/relativeTime'
import { getApiErrorMessage } from '../utils/apiError'
import { usePagination } from '../hooks/usePagination'

type TabKey = 'ongoing' | 'history'
type StatusKey = 'draft' | 'active' | 'inactive' | 'closed'
type PendingAction = { type: 'close' | 'delete'; consultation: Consultation }

const STATUS_BADGES: Record<StatusKey, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'bg-sky-100 text-sky-700' },
  active: { label: 'Activa', className: 'bg-emerald-100 text-emerald-700' },
  inactive: { label: 'Inactiva', className: 'bg-amber-100 text-amber-700' },
  closed: { label: 'Finalizada', className: 'bg-slate-100 text-slate-600' },
}

function statusKeyOf(consultation: Consultation): StatusKey {
  if (consultation.status === 'active') return 'active'
  if (consultation.status === 'created') return 'draft'
  return consultation.auto_closed ? 'inactive' : 'closed'
}

function activityTimestamp(consultation: Consultation): number {
  const value = consultation.last_activity_at || consultation.closed_at || consultation.created_at
  return new Date(value).getTime()
}

export default function MyConsultations() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('ongoing')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  const loadConsultations = useCallback(async () => {
    const data = await getMyConsultations()
    setConsultations(data.consultations)
  }, [])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
      return
    }
    if (!isAuthenticated) return

    loadConsultations()
      .catch((error) => toast.error(getApiErrorMessage(error, 'No se pudieron cargar tus consultas.')))
      .finally(() => setLoading(false))
  }, [isAuthenticated, authLoading, navigate, loadConsultations, toast])

  // Agrupamos por estado (en curso / historial) y ordenamos por última actividad.
  const { ongoing, history } = useMemo(() => {
    const byActivityDesc = (a: Consultation, b: Consultation) =>
      activityTimestamp(b) - activityTimestamp(a)
    return {
      ongoing: consultations.filter((c) => c.status !== 'closed').sort(byActivityDesc),
      history: consultations.filter((c) => c.status === 'closed').sort(byActivityDesc),
    }
  }, [consultations])

  // El listado visible y su paginación deben calcularse antes de cualquier
  // return condicional para respetar las reglas de los Hooks.
  const visible = tab === 'ongoing' ? ongoing : history
  const { page, setPage, pageItems, totalPages, totalItems, pageSize } = usePagination(visible, 8, tab)

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleConfirmAction = async () => {
    if (!pendingAction) return
    setActionBusy(true)
    try {
      if (pendingAction.type === 'close') {
        await closeConsultation(pendingAction.consultation.id)
        toast.success('Consulta finalizada. La encontrarás en tu historial.')
      } else {
        await deleteConsultation(pendingAction.consultation.id)
        toast.success('Borrador eliminado.')
      }
      await loadConsultations()
      setPendingAction(null)
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo completar la acción.'))
      setPendingAction(null)
    } finally {
      setActionBusy(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-72" />
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (consultations.length === 0) {
    return (
      <div>
        <BackButton />
        <div className="mb-6 flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-primary-600" />
          <h1 className="text-3xl font-bold text-slate-800">Mis consultas</h1>
        </div>
        <div className="card text-center py-12">
          <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">Aún no tienes consultas registradas.</p>
          <Link to="/specialties" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Buscar especialidad
          </Link>
        </div>
      </div>
    )
  }

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'ongoing', label: 'En curso', count: ongoing.length },
    { key: 'history', label: 'Historial', count: history.length },
  ]

  return (
    <div>
      <BackButton />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-primary-600" />
          <h1 className="text-3xl font-bold text-slate-800">Mis consultas</h1>
        </div>
        <Link to="/specialties" className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nueva consulta
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Filtrar consultas"
        className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
      >
        {tabs.map((item) => {
          const selected = tab === item.key
          return (
            <button type="button"
              key={item.key}
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                selected ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  selected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item.count}
              </span>
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <div className="card py-12 text-center text-slate-500">
          {tab === 'ongoing'
            ? 'No tienes consultas en curso. Inicia una desde una especialidad.'
            : 'Todavía no tienes consultas finalizadas.'}
        </div>
      ) : (
        <div className="space-y-4">
          {pageItems.map((consultation) => (
            <ConsultationCard
              key={consultation.id}
              consultation={consultation}
              expanded={expanded.has(consultation.id)}
              onToggle={() => toggleExpanded(consultation.id)}
              onClose={(c) => setPendingAction({ type: 'close', consultation: c })}
              onDelete={(c) => setPendingAction({ type: 'delete', consultation: c })}
            />
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

      <ConfirmDialog
        open={pendingAction !== null}
        tone={pendingAction?.type === 'delete' ? 'danger' : 'default'}
        title={pendingAction?.type === 'delete' ? '¿Eliminar este borrador?' : '¿Finalizar esta consulta?'}
        description={
          pendingAction?.type === 'delete'
            ? 'Se eliminará de forma permanente. Esta acción no se puede deshacer.'
            : 'Se moverá al historial y no podrás seguir conversando con la IA en esta consulta. Podrás iniciar una nueva cuando quieras.'
        }
        confirmLabel={pendingAction?.type === 'delete' ? 'Eliminar' : 'Finalizar'}
        busy={actionBusy}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  )
}

interface ConsultationCardProps {
  consultation: Consultation
  expanded: boolean
  onToggle: () => void
  onClose: (consultation: Consultation) => void
  onDelete: (consultation: Consultation) => void
}

function ConsultationCard({ consultation, expanded, onToggle, onClose, onDelete }: ConsultationCardProps) {
  const statusKey = statusKeyOf(consultation)
  const badge = STATUS_BADGES[statusKey]
  const specialtyName = consultation.specialty?.name || 'Especialidad'
  const specialtyLink = consultation.specialty ? `/specialties/${consultation.specialty.slug}` : '/specialties'
  const hasDetails = Boolean(consultation.summary || consultation.intake)
  const canClose = consultation.status !== 'closed'
  const canDelete = consultation.status === 'created'

  const metaText =
    consultation.status === 'closed'
      ? `Cerrada ${formatRelativeTime(consultation.closed_at || consultation.last_activity_at)}`
      : `Última actividad ${formatRelativeTime(consultation.last_activity_at || consultation.created_at)}`

  return (
    <article className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-slate-800">{specialtyName}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {metaText}
            <span className="mx-1.5 text-slate-300" aria-hidden="true">
              •
            </span>
            Iniciada {formatRelativeTime(consultation.created_at)}
          </p>
        </div>
        {consultation.specialty && (
          <Link
            to={specialtyLink}
            aria-label={`Ver especialidad ${specialtyName}`}
            className="shrink-0 rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary-600"
          >
            <ExternalLink className="h-5 w-5" />
          </Link>
        )}
      </div>

      {statusKey === 'inactive' && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Se cerró automáticamente por inactividad. Puedes iniciar una nueva consulta de {specialtyName} cuando quieras.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        {consultation.status === 'created' && (
          <Link to={`/consultation/${consultation.id}/chat`} className="btn-primary inline-flex items-center gap-2">
            <Play className="h-4 w-4" />
            Iniciar pre-consulta IA
          </Link>
        )}

        {consultation.status === 'active' && (
          <Link to={`/consultation/${consultation.id}/chat`} className="btn-primary inline-flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Continuar consulta IA
          </Link>
        )}

        {consultation.status === 'closed' && consultation.summary && (
          <Link to={`${specialtyLink}?consultation=${consultation.id}`} className="btn-primary inline-flex items-center gap-2">
            <Video className="h-4 w-4" />
            Agendar videoconsulta
          </Link>
        )}

        {consultation.status === 'closed' && !consultation.summary && (
          <Link to={specialtyLink} className="btn-secondary inline-flex items-center gap-2">
            <Play className="h-4 w-4" />
            Iniciar nueva consulta
          </Link>
        )}

        {hasDetails && (
          <SummaryToggleButton expanded={expanded} onClick={onToggle} />
        )}

        {(canClose || canDelete) && (
          <div className="ml-auto flex items-center gap-1">
            {canClose && (
              <button
                type="button"
                onClick={() => onClose(consultation)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                <CheckCircle2 className="h-4 w-4" />
                Finalizar
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(consultation)}
                aria-label="Eliminar borrador"
                title="Eliminar borrador"
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          {consultation.summary && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-slate-700">Resumen para el médico</h4>
              <RichText text={consultation.summary} className="text-sm text-slate-600" />
            </div>
          )}
          {consultation.intake && (
            <StructuredIntakeCard
              intake={consultation.intake}
              title="Ficha clínica estructurada"
              description="Datos clave extraídos de la conversación para que el médico los revise de un vistazo."
            />
          )}
        </div>
      )}
    </article>
  )
}
