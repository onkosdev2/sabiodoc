import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Search, Sparkles } from 'lucide-react'

import Button from '../components/ui/Button'

import { getSpecialties, getTopSpecialties, Specialty } from '../api/specialties'
import SpecialtyCard from '../components/SpecialtyCard'
import AlarmSymptomsBanner from '../components/AlarmSymptomsBanner'
import BackButton from '../components/BackButton'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import { detectAlarmSymptoms } from '../utils/symptomAlerts'

export default function Specialties() {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [topSpecialties, setTopSpecialties] = useState<Specialty[]>([])
  const [allSpecialties, setAllSpecialties] = useState<Specialty[]>([])
  const [searchResults, setSearchResults] = useState<Specialty[]>([])
  const [loading, setLoading] = useState(false)
  const [debouncing, setDebouncing] = useState(false)
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
    if (query.length < 2) {
      setDebouncing(false)
      setSearchResults([])
      return
    }

    setDebouncing(true)
    const timer = setTimeout(() => {
      setDebouncing(false)
      searchSpecialties(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, searchSpecialties])

  const isSearching = query.length >= 2
  const isSearchPending = loading || debouncing
  const alarmFlags = useMemo(() => detectAlarmSymptoms(query), [query])
  const showEmpty = isSearching && !isSearchPending && searchResults.length === 0

  return (
    <div>
      <BackButton />

      <PageHeader
        icon={Search}
        title="Buscar especialidad"
        description="Busca por nombre o palabra clave (p. ej. cardiología). Para orientarte según tus síntomas, usa la guía de orientación."
        className="mb-6"
      />

      <div className="relative mb-6">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Buscar especialidad por nombre o palabra clave"
          placeholder="Buscar por nombre (ej: cardiología, pediatría, dermatología...)"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input-field py-3 pl-12 pr-10 text-lg"
        />
        {isSearchPending && <Spinner size="sm" className="absolute right-4 top-1/2 -translate-y-1/2" />}
      </div>

      <AlarmSymptomsBanner flags={alarmFlags} />

      {initialLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : isSearching ? (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-slate-700">
            {isSearchPending && searchResults.length === 0 ? 'Buscando…' : `Resultados (${searchResults.length})`}
          </h2>
          {isSearchPending && searchResults.length === 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {searchResults.map((specialty) => (
                <SpecialtyCard key={specialty.id} specialty={specialty} />
              ))}
            </div>
          ) : showEmpty ? (
            <EmptyState
              icon={Search}
              title="Sin resultados"
              description={`No encontramos especialidades para "${query}". Prueba con otras palabras o usa la guía de orientación.`}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="secondary" onClick={() => setQuery('')}>
                    Limpiar búsqueda
                  </Button>
                  <Link to="/guide" className="btn-secondary">
                    Usar la guía
                  </Link>
                </div>
              }
            />
          ) : null}
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
