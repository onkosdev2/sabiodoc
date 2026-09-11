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
            <h3 className="text-lg font-semibold text-gray-800">{specialty.name}</h3>
          </div>
          {specialty.description && (
            <p className="text-gray-600 mt-2 text-sm line-clamp-2">
              {specialty.description}
            </p>
          )}
        </div>
        
        {showFavorite && (
          <button
            onClick={(e) => {
              e.preventDefault()
              onToggleFavorite?.()
            }}
            className={`p-2 rounded-full transition-colors ${
              isFavorite 
                ? 'text-yellow-500 hover:text-yellow-600' 
                : 'text-gray-300 hover:text-yellow-500'
            }`}
          >
            <Star className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>
      
      <Link 
        to={`/specialties/${specialty.slug}`}
        className="inline-flex items-center gap-1 mt-4 text-primary-600 hover:text-primary-700 font-medium text-sm"
      >
        Ver detalles
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
