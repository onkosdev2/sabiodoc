import { useCallback, useEffect, useState } from 'react'
import { RefreshCcw, Star } from 'lucide-react'

import { DoctorReviewsResponse, getMyDoctorReviews } from '../api/doctors'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import BackButton from '../components/BackButton'
import Pagination from '../components/Pagination'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import { usePagination } from '../hooks/usePagination'

function Stars({ value, className = 'h-4 w-4' }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={`${className} ${star <= Math.round(value) ? 'fill-current text-amber-400' : 'text-slate-300'}`}
        />
      ))}
    </span>
  )
}

export default function DoctorReviews() {
  const toast = useToast()
  const [data, setData] = useState<DoctorReviewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const reviews = data?.reviews ?? []
  const { page, setPage, pageItems, totalPages, totalItems, pageSize } = usePagination(reviews, 8)

  const loadReviews = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getMyDoctorReviews()
      setData(response)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar las valoraciones.'))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  return (
    <div className="space-y-6">
      <BackButton />

      <PageHeader
        title="Valoraciones"
        description="Reseñas reales que dejan tus pacientes al completar una cita."
        actions={
          <Button
            variant="secondary"
            onClick={loadReviews}
            disabled={loading}
            leftIcon={<RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Recargar
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : !data ? (
        <EmptyState icon={Star} title="No hay valoraciones disponibles" description="Aparecerán cuando tus pacientes valoren una cita completada." />
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-wrap items-center gap-8">
              <div className="text-center">
                <p className="text-5xl font-bold text-slate-950">{data.rating_avg.toFixed(1)}</p>
                <Stars value={data.rating_avg} className="h-5 w-5" />
                <p className="mt-1 text-sm text-slate-500">{data.rating_count} valoraciones</p>
              </div>
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-900">{data.total} reseñas escritas</p>
                <p className="mt-1">Solo las citas completadas pueden dejar reseña.</p>
              </div>
            </div>
          </section>

          {reviews.length === 0 ? (
            <EmptyState icon={Star} title="Aún no tienes reseñas escritas" description="Cuando un paciente deje un comentario, lo verás aquí." />
          ) : (
            <div className="space-y-4">
              {pageItems.map((review) => (
                <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Stars value={review.rating} />
                    <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {new Date(review.created_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {review.comment && <p className="mt-3 leading-relaxed text-slate-700">{review.comment}</p>}
                  <p className="mt-3 text-sm font-medium text-slate-500">{review.patient_label}</p>
                </article>
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
        </>
      )}
    </div>
  )
}
