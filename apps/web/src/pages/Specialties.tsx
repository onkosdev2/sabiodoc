import { useState, useEffect, useCallback } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { getSpecialties, getTopSpecialties, Specialty } from '../api/specialties'
import SpecialtyCard from '../components/SpecialtyCard'
import BackButton from '../components/BackButton'

export default function Specialties() {
  const [query, setQuery] = useState('')
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [topSpecialties, setTopSpecialties] = useState<Specialty[]>([])
  const [loading, setLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const loadTop = async () => {
      try {
        const data = await getTopSpecialties()
        setTopSpecialties(data.specialties)
      } catch (error) {
        console.error('Error loading top specialties:', error)
      }
    }
    loadTop()
  }, [])

  const searchSpecialties = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSpecialties([])
      return
    }

    setLoading(true)
    try {
      const data = await getSpecialties(searchQuery)
      setSpecialties(data.specialties)
    } catch (error) {
      console.error('Error searching specialties:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchSpecialties(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, searchSpecialties])

  const loadAllSpecialties = async () => {
    setLoading(true)
    try {
      const data = await getSpecialties()
      setSpecialties(data.specialties)
      setShowAll(true)
    } catch (error) {
      console.error('Error loading all specialties:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <BackButton />
      
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Buscar Especialidad
      </h1>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar por nombre o síntomas (ej: cardiólogo, dolor de cabeza...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input-field pl-12 text-lg py-3"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 text-primary-500 w-5 h-5 animate-spin" />
        )}
      </div>

      {query.length >= 2 && specialties.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Resultados ({specialties.length})
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {specialties.map((specialty) => (
              <SpecialtyCard key={specialty.id} specialty={specialty} />
            ))}
          </div>
        </div>
      )}

      {query.length >= 2 && specialties.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No se encontraron especialidades para "{query}"
        </div>
      )}

      {query.length < 2 && !showAll && (
        <>
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">
              ⭐ Especialidades Destacadas
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {topSpecialties.map((specialty) => (
                <SpecialtyCard key={specialty.id} specialty={specialty} />
              ))}
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={loadAllSpecialties}
              className="btn-secondary"
              disabled={loading}
            >
              {loading ? 'Cargando...' : 'Ver todas las especialidades'}
            </button>
          </div>
        </>
      )}

      {showAll && query.length < 2 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Todas las Especialidades ({specialties.length})
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {specialties.map((specialty) => (
              <SpecialtyCard key={specialty.id} specialty={specialty} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
