import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Heart, Trash2 } from 'lucide-react'
import { getMyFavorites, removeFavorite, Favorite } from '../api/favorites'
import { useAuth } from '../context/AuthContext'
import BackButton from '../components/BackButton'

export default function MyFavorites() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
      return
    }

    const loadFavorites = async () => {
      if (!isAuthenticated) return
      
      try {
        const data = await getMyFavorites()
        setFavorites(data.favorites)
      } catch (error) {
        console.error('Error loading favorites:', error)
      } finally {
        setLoading(false)
      }
    }
    
    if (isAuthenticated) {
      loadFavorites()
    }
  }, [isAuthenticated, authLoading, navigate])

  const handleRemove = async (specialtyId: number) => {
    try {
      await removeFavorite(specialtyId)
      setFavorites(prev => prev.filter(f => f.specialty_id !== specialtyId))
    } catch (error) {
      console.error('Error removing favorite:', error)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <BackButton />
      
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        ⭐ Mis Favoritos
      </h1>

      {favorites.length === 0 ? (
        <div className="card text-center py-12">
          <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No tienes especialidades favoritas</p>
          <Link to="/specialties" className="btn-primary">
            Explorar especialidades
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {favorites.map((favorite) => (
            <div key={favorite.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {favorite.specialty?.name || 'Especialidad'}
                  </h3>
                  {favorite.specialty?.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {favorite.specialty.description}
                    </p>
                  )}
                  {favorite.specialty && (
                    <Link
                      to={`/specialties/${favorite.specialty.slug}`}
                      className="inline-block mt-3 text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      Ver detalles →
                    </Link>
                  )}
                </div>
                
                <button
                  onClick={() => favorite.specialty_id && handleRemove(favorite.specialty_id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Eliminar de favoritos"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
