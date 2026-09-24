import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import { Specialty } from '../api/specialties'

interface SpecialtyCardProps {
  specialty: Specialty
}

export default function SpecialtyCard({ specialty }: SpecialtyCardProps) {
  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800">{specialty.name}</h3>
          </div>
          {specialty.description && (
            <p className="text-slate-600 mt-2 text-sm line-clamp-2">{specialty.description}</p>
          )}
        </div>
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
