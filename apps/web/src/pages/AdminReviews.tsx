import { useCallback, useEffect, useState } from 'react'
import { Flag } from 'lucide-react'

import {
  AdminReviewReportItem,
  ReviewReportStatus,
  getReviewReports,
  hideReview,
  unhideReview,
  updateReviewReportStatus,
} from '../api/admin'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import Badge from '../components/ui/Badge'
import type { BadgeTone } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import { Textarea } from '../components/ui/Field'

const STATUS_LABELS: Record<ReviewReportStatus, string> = {
  pending: 'Pendiente',
  resolved: 'Resuelto',
  dismissed: 'Descartado',
}

const STATUS_TONES: Record<ReviewReportStatus, BadgeTone> = {
  pending: 'warning',
  resolved: 'success',
  dismissed: 'neutral',
}

const FILTERS: { value: ReviewReportStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'resolved', label: 'Resueltos' },
  { value: 'dismissed', label: 'Descartados' },
  { value: 'all', label: 'Todos' },
]

const stars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(Math.max(0, 5 - rating))

export default function AdminReviews() {
  const toast = useToast()
  const [filter, setFilter] = useState<ReviewReportStatus | 'all'>('pending')
  const [reports, setReports] = useState<AdminReviewReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [hideTarget, setHideTarget] = useState<AdminReviewReportItem | null>(null)
  const [hideReason, setHideReason] = useState('')

  const load = useCallback(
    async (nextFilter: ReviewReportStatus | 'all') => {
      setLoading(true)
      try {
        const data = await getReviewReports(nextFilter === 'all' ? undefined : nextFilter)
        setReports(data.reports)
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudieron cargar los reportes'))
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    load(filter)
  }, [filter, load])

  const handleStatus = async (report: AdminReviewReportItem, status: 'resolved' | 'dismissed') => {
    setSavingId(report.id)
    try {
      await updateReviewReportStatus(report.id, status)
      toast.success(
        status === 'resolved' ? 'Reporte marcado como resuelto.' : 'Reporte descartado.',
      )
      await load(filter)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar el reporte'))
    } finally {
      setSavingId(null)
    }
  }

  const handleUnhide = async (reviewId: number) => {
    setSavingId(reviewId)
    try {
      await unhideReview(reviewId)
      toast.success('Reseña restaurada.')
      await load(filter)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo restaurar la reseña'))
    } finally {
      setSavingId(null)
    }
  }

  const submitHide = async () => {
    if (!hideTarget) return
    setSavingId(hideTarget.id)
    try {
      await hideReview(hideTarget.review_id, hideReason)
      toast.success('Reseña ocultada.')
      setHideTarget(null)
      setHideReason('')
      await load(filter)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo ocultar la reseña'))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Flag}
        title="Moderación de reseñas"
        description="Revisa los reportes de pacientes y oculta las reseñas que incumplan las normas."
      />

      <div
        role="tablist"
        aria-label="Filtrar reportes"
        className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1"
      >
        {FILTERS.map((option) => {
          const selected = filter === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(option.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
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
          {[0, 1].map((index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Sin reportes"
          description="No hay reportes de reseñas para este filtro."
        />
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Flag className="h-4 w-4 text-red-500" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">Reporte #{report.id}</p>
                <Badge tone={STATUS_TONES[report.status]}>{STATUS_LABELS[report.status]}</Badge>
                {report.review.is_hidden && <Badge tone="neutral">Reseña oculta</Badge>}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {report.reporter_email} · {new Date(report.created_at).toLocaleString('es-ES')}
              </p>

              {report.reason && (
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  <span className="font-medium">Motivo del reporte: </span>
                  {report.reason}
                </p>
              )}

              <div className="mt-3 rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    {report.review.doctor_name || 'Médico'}
                  </p>
                  <span className="text-amber-500" aria-label={`${report.review.rating} de 5`}>
                    {stars(report.review.rating)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  {report.review.comment || 'Sin comentario.'}
                </p>
                {report.review.hidden_reason && (
                  <p className="mt-2 text-xs text-slate-500">
                    Motivo de ocultamiento: {report.review.hidden_reason}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {report.review.is_hidden ? (
                  <Button
                    variant="secondary"
                    onClick={() => handleUnhide(report.review.id)}
                    disabled={savingId === report.review.id}
                  >
                    Restaurar reseña
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    onClick={() => {
                      setHideTarget(report)
                      setHideReason('')
                    }}
                    disabled={savingId === report.id}
                  >
                    Ocultar reseña
                  </Button>
                )}
                {report.status === 'pending' && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => handleStatus(report, 'resolved')}
                      disabled={savingId === report.id}
                    >
                      Marcar resuelto
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleStatus(report, 'dismissed')}
                      disabled={savingId === report.id}
                    >
                      Descartar reporte
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={hideTarget !== null}
        onClose={() => {
          if (savingId !== hideTarget?.id) {
            setHideTarget(null)
            setHideReason('')
          }
        }}
        title="Ocultar reseña"
        description="La reseña dejará de mostrarse en el perfil del médico y no contará para su valoración. Puedes restaurarla después."
      >
        <Textarea
          label="Motivo (opcional)"
          value={hideReason}
          onChange={(event) => setHideReason(event.target.value)}
          className="min-h-24"
          maxLength={1000}
          placeholder="Ej: lenguaje ofensivo, datos personales, spam..."
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setHideTarget(null)} disabled={savingId !== null}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={submitHide} loading={savingId === hideTarget?.id}>
            Ocultar reseña
          </Button>
        </div>
      </Modal>
    </div>
  )
}
