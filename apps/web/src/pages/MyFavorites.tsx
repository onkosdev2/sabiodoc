import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, Trash2 } from 'lucide-react'

import { getMyFavorites, removeFavorite, Favorite } from '../api/favorites'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import BackButton from '../components/BackButton'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/Pagination'
import Skeleton from '../components/ui/Skeleton'
import { getApiErrorMessage } from '../utils/apiError'
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

  const handleRemove = async (specialtyId: number) => {
    setRemovingId(specialtyId)
    try {
      await removeFavorite(specialtyId)
      setFavorites((prev) => prev.filter((favorite) => favorite.specialty_id !== specialtyId))
      toast.success('Quitado de favoritos.')
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
          <Skeleton key={index} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <BackButton />

      <PageHeader icon={Heart} title="Mis favoritos" description="Tus especialidades guardadas." className="mb-6" />

      {favorites.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No tienes especialidades favoritas"
          description="Guarda especialidades para acceder rápido a sus médicos."
          action={
            <Link to="/specialties" className="btn-primary">
              Explorar especialidades
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pageItems.map((favorite) => (
            <Card key={favorite.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-slate-800">
                    {favorite.specialty?.name || 'Especialidad'}
                  </h3>
                  {favorite.specialty?.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{favorite.specialty.description}</p>
                  )}
                  {favorite.specialty && (
                    <Link
                      to={`/specialties/${favorite.specialty.slug}`}
                      className="mt-3 inline-block text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      Ver detalles →
                    </Link>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => favorite.specialty_id && handleRemove(favorite.specialty_id)}
                  loading={removingId === favorite.specialty_id}
                  aria-label={`Quitar ${favorite.specialty?.name || 'especialidad'} de favoritos`}
                  title="Eliminar de favoritos"
                  className="text-slate-500 hover:text-red-600"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </Card>
          ))}
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
