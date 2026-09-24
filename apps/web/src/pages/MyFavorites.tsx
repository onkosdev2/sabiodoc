import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, CircleDollarSign, Heart, Star, Trash2 } from 'lucide-react'

import { getMyFavorites, removeFavorite, Favorite } from '../api/favorites'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import BackButton from '../components/BackButton'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/Pagination'
import PresenceBadge from '../components/PresenceBadge'
import Skeleton from '../components/ui/Skeleton'
import { getApiErrorMessage } from '../utils/apiError'
import { formatMoney } from '../utils/format'
import { usePagination } from '../hooks/usePagination'

export default function MyFavorites() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const { page, setPage, pageItems, totalPages, totalItems, pageSize } = usePagination(favorites, 8)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
      return
    }
    if (!isAuthenticated) return

    const loadFavorites = async () => {
      try {
        const data = await getMyFavorites()
        setFavorites(data.favorites)
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudieron cargar tus favoritos.'))
      } finally {
        setLoading(false)
      }
    }

    loadFavorites()
  }, [isAuthenticated, authLoading, navigate, toast])

  const handleRemove = async (doctorId: number) => {
    setRemovingId(doctorId)
    try {
      await removeFavorite(doctorId)
      setFavorites((prev) => prev.filter((favorite) => favorite.doctor_id !== doctorId))
      toast.success('Médico quitado de favoritos.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo quitar de favoritos.'))
    } finally {
      setRemovingId(null)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <BackButton />

      <PageHeader
        icon={Heart}
        title="Mis favoritos"
        description="Tus médicos guardados."
        className="mb-6"
      />

      {favorites.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No tienes médicos favoritos"
          description="Guarda médicos para acceder rápido a su perfil y agendar una cita."
          action={
            <Link to="/specialties" className="btn-primary">
              Explorar especialidades
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pageItems.map((favorite) => {
            const doctor = favorite.doctor
            if (!doctor) {
              return (
                <Card key={favorite.id}>
                  <p className="text-sm text-slate-500">Este médico ya no está disponible.</p>
                </Card>
              )
            }
            return (
              <Card key={favorite.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-800">{doctor.display_name}</h3>
                      <PresenceBadge presence={doctor.presence} />
                    </div>
                    {doctor.professional_title && (
                      <p className="mt-1 text-sm text-slate-600">{doctor.professional_title}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-700">
                      {doctor.rating_count > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          {Number(doctor.rating_avg).toFixed(1)}
                          <span className="text-slate-500">({doctor.rating_count})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <Star className="h-4 w-4 text-slate-300" />
                          Sin reseñas
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <CircleDollarSign className="h-4 w-4 text-emerald-600" />
                        <span className="font-medium">{formatMoney(doctor.price_per_min_cents)}</span>/min
                      </span>
                    </div>

                    <Link
                      to={`/doctors/${doctor.id}`}
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      Ver perfil
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(favorite.doctor_id)}
                    loading={removingId === favorite.doctor_id}
                    aria-label={`Quitar ${doctor.display_name} de favoritos`}
                    title="Eliminar de favoritos"
                    className="text-slate-500 hover:text-red-600"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </Card>
            )
          })}
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
            className="md:col-span-2"
          />
        </div>
      )}
    </div>
  )
}
