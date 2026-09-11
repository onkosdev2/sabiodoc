import { useState, useEffect, useCallback } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { getSpecialties, getTopSpecialties, Specialty } from '../api/specialties'
import SpecialtyCard from '../components/SpecialtyCard'
import BackButton from '../components/BackButton'

export default function Specialties() {
  const [query, setQuery] = useState('')
  
  const [topSpecialties, setTopSpecialties] = useState<Specialty[]>([])
  const [allSpecialties, setAllSpecialties] = useState<Specialty[]>([])
  const [searchResults, setSearchResults] = useState<Specialty[]>([])
  
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [topData, allData] = await Promise.all([
          getTopSpecialties(),
          getSpecialties()
        ])
        
        setTopSpecialties(topData.specialties)
        
        // Extraemos los IDs de las destacadas para filtrarlas de la lista general
        const topSpecialtyIds = topData.specialties.map(s => s.id)
        
        // Filtramos "Todas" para que no incluya las que ya están en "Destacadas"
        const filteredAllSpecialties = allData.specialties.filter(
          specialty => !topSpecialtyIds.includes(specialty.id)
        )
        
        setAllSpecialties(filteredAllSpecialties)
      } catch (error) {
        console.error('Error loading initial data:', error)
      } finally {
        setInitialLoading(false)
      }
    }
    
    loadInitialData()
  }, [])

  const searchSpecialties = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    setLoading(true)
    try {
      const data = await getSpecialties(searchQuery)
      setSearchResults(data.specialties)
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

  return (
    <div>
      <BackButton />
      
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Buscar Especialidad
      </h1>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
        
        <input
          type="text"
          placeholder="Buscar por nombre o síntomas (ej: cardiólogo, dolor de cabeza...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Se mantiene input-field pero forzamos el padding izquierdo por si tu CSS lo sobreescribe
          className="w-full input-field text-lg py-3 pr-10" 
          style={{ paddingLeft: '3rem' }} 
        />
        
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 text-primary-500 w-5 h-5 animate-spin pointer-events-none" />
        )}
      </div>

      {initialLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="text-primary-500 w-8 h-8 animate-spin" />
        </div>
      ) : (
        <>
          {query.length >= 2 ? (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">
                Resultados ({searchResults.length})
              </h2>
              
              {searchResults.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {searchResults.map((specialty) => (
                    <SpecialtyCard key={specialty.id} specialty={specialty} />
                  ))}
                </div>
              ) : (
                !loading && (
                  <div className="text-center py-8 text-gray-500">
                    No se encontraron especialidades para "{query}"
                  </div>
                )
              )}
            </div>
          ) : (
            <>
              {topSpecialties.length > 0 && (
                <div className="mb-10">
                  <h2 className="text-xl font-semibold text-gray-700 mb-4">
                    ⭐ Especialidades Destacadas
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {topSpecialties.map((specialty) => (
                      <SpecialtyCard key={specialty.id} specialty={specialty} />
                    ))}
                  </div>
                </div>
              )}

              {allSpecialties.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-700 mb-4">
                    Otras Especialidades ({allSpecialties.length})
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {allSpecialties.map((specialty) => (
                      <SpecialtyCard key={specialty.id} specialty={specialty} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}