import { useCallback, useEffect, useState } from 'react'
import { Link, Search, Sparkles } from 'lucide-react'

import { getSpecialties, getTopSpecialties, Specialty } from '../api/specialties'
import SpecialtyCard from '../components/SpecialtyCard'
import BackButton from '../components/BackButton'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'

export default function Specialties() {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [topSpecialties, setTopSpecialties] = useState<Specialty[]>([])
  const [allSpecialties, setAllSpecialties] = useState<Specialty[]>([])
  const [searchResults, setSearchResults] = useState<Specialty[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [topData, allData] = await Promise.all([getTopSpecialties(), getSpecialties()])
        setTopSpecialties(topData.specialties)

        // Las destacadas no se repiten en "Otras".
        const topSpecialtyIds = topData.specialties.map((specialty) => specialty.id)
        setAllSpecialties(allData.specialties.filter((specialty) => !topSpecialtyIds.includes(specialty.id)))
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudieron cargar las especialidades.'))
      } finally {
        setInitialLoading(false)
      }
    }

    loadInitialData()
  }, [toast])

  const searchSpecialties = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setSearchResults([])
        return
      }

      setLoading(true)
      try {
        const data = await getSpecialties(searchQuery)
        setSearchResults(data.specialties)
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudo completar la búsqueda.'))
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      searchSpecialties(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, searchSpecialties])

  const isSearching = query.length >= 2

  return (
    <div>
      <BackButton />

      <PageHeader
        icon={Search}
        title="Buscar especialidad"
        description="Encuentra el área médica adecuada por nombre o por síntomas."
        className="mb-6"
      />

      <div className="relative mb-8">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Buscar especialidad por nombre o síntomas"
          placeholder="Buscar por nombre o síntomas (ej: cardiólogo, dolor de cabeza...)"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input-field py-3 pl-12 pr-10 text-lg"
        />
        {loading && <Spinner size="sm" className="absolute right-4 top-1/2 -translate-y-1/2" />}
      </div>

      {initialLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : isSearching ? (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-slate-700">Resultados ({searchResults.length})</h2>
          {searchResults.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {searchResults.map((specialty) => (
                <SpecialtyCard key={specialty.id} specialty={specialty} />
              ))}
            </div>
          ) : (
            !loading && (
              <EmptyState
                icon={Search}
                title="Sin resultados"
                description={`No encontramos especialidades para "${query}". Prueba con otras palabras.`}
                action={
                  <button type="button" onClick={() => setQuery('')} className="btn-secondary">
                    Limpiar búsqueda
                  </button>
                }
              />
            )
          )}
        </section>
      ) : (
        <>
          {topSpecialties.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 inline-flex items-center gap-2 text-xl font-semibold text-slate-700">
                <Sparkles className="h-5 w-5 text-amber-500" aria-hidden="true" />
                Especialidades destacadas
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {topSpecialties.map((specialty) => (
                  <SpecialtyCard key={specialty.id} specialty={specialty} />
                ))}
              </div>
            </section>
          )}

          {allSpecialties.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold text-slate-700">
                Otras especialidades ({allSpecialties.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {allSpecialties.map((specialty) => (
                  <SpecialtyCard key={specialty.id} specialty={specialty} />
                ))}
              </div>
            </section>
          )}

          {topSpecialties.length === 0 && allSpecialties.length === 0 && (
            <EmptyState
              icon={Search}
              title="Aún no hay especialidades"
              description="Vuelve a intentarlo en unos minutos."
              action={
                <Link to="/" className="btn-secondary">
                  Ir al inicio
                </Link>
              }
            />
          )}
        </>
      )}
    </div>
  )
}
