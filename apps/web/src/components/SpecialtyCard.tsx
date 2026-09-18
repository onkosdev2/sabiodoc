import { Link } from 'react-router-dom'
import { ArrowRight, Star } from 'lucide-react'
import { Specialty } from '../api/specialties'

interface SpecialtyCardProps {
  specialty: Specialty
  showFavorite?: boolean
  isFavorite?: boolean
  onToggleFavorite?: () => void
}

export default function SpecialtyCard({ 
  specialty, 
  showFavorite = false,
  isFavorite = false,
  onToggleFavorite
}: SpecialtyCardProps) {
  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800">{specialty.name}</h3>
          </div>
          {specialty.description && (
            <p className="text-slate-600 mt-2 text-sm line-clamp-2">
              {specialty.description}
            </p>
          )}
        </div>
        
        {showFavorite && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              onToggleFavorite?.()
            }}
            aria-label={isFavorite ? `Quitar ${specialty.name} de favoritos` : `Añadir ${specialty.name} a favoritos`}
            aria-pressed={isFavorite}
            className={`rounded-full p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-slate-300 hover:text-yellow-500'
            }`}
          >
            <Star className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} aria-hidden="true" />
          </button>
        )}
      </div>
      
      <Link
        to={`/specialties/${specialty.slug}`}
        className="mt-4 inline-flex items-center gap-1 rounded text-sm font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        Ver detalles
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  )
}
