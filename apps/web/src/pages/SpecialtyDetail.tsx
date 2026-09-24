import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Star, Calendar, Loader2, ChevronRight, CircleDollarSign, RefreshCcw, Search } from 'lucide-react'
import Button from '../components/ui/Button'
import { getSpecialtyBySlug, Specialty } from '../api/specialties'
import { createConsultation, getMyConsultations } from '../api/consultations'
import { addFavorite, removeFavorite, getMyFavorites } from '../api/favorites'
import DoctorFavoriteButton from '../components/DoctorFavoriteButton'
import { DoctorCard, getDoctorsBySpecialty } from '../api/doctors'
import { useAuth } from '../context/AuthContext'
import BackButton from '../components/BackButton'
import PresenceBadge from '../components/PresenceBadge'
import { formatMoney } from '../utils/format'

type DoctorSort = 'availability' | 'rating' | 'name' | 'price_asc' | 'price_desc'

export default function SpecialtyDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const consultationId = searchParams.get('consultation')
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [specialty, setSpecialty] = useState<Specialty | null>(null)
  const [doctors, setDoctors] = useState<DoctorCard[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingDoctors, setRefreshingDoctors] = useState(false)
  const [favoriteDoctorIds, setFavoriteDoctorIds] = useState<Set<number>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  const [consultationNotice, setConsultationNotice] = useState<string | null>(null)
  const [openConsultations, setOpenConsultations] = useState<
    Array<{ id: number; specialtyId: number | null; specialtyName: string | null }>
  >([])
  const [doctorSearch, setDoctorSearch] = useState('')
  const [doctorSort, setDoctorSort] = useState<DoctorSort>('rating')

  const loadData = useCallback(async () => {
    if (!slug) return
    try {
      const data = await getSpecialtyBySlug(slug)
      setSpecialty(data)
      const doctorsData = await getDoctorsBySpecialty(slug)
      setDoctors(doctorsData.doctors)

      if (isAuthenticated) {
        const favorites = await getMyFavorites()
        setFavoriteDoctorIds(new Set(favorites.favorites.map((f) => f.doctor_id)))

        const consultations = await getMyConsultations()
        setOpenConsultations(
          consultations.consultations
            .filter((item) => item.status === 'created' || item.status === 'active')
            .map((item) => ({
              id: item.id,
              specialtyId: item.specialty?.id ?? null,
              specialtyName: item.specialty?.name ?? null,
            })),
        )
      }
    } catch (error) {
      console.error('Error loading specialty:', error)
    }
  }, [slug, isAuthenticated])

  useEffect(() => {
    setLoading(true)
    loadData().finally(() => setLoading(false))
  }, [loadData])

  const handleRefreshDoctors = async () => {
    if (!slug) return
    setRefreshingDoctors(true)
    try {
      const doctorsData = await getDoctorsBySpecialty(slug)
      setDoctors(doctorsData.doctors)
    } catch (error) {
      console.error('Error refreshing doctors:', error)
    } finally {
      setRefreshingDoctors(false)
    }
  }

  const handleToggleDoctorFavorite = async (doctorId: number) => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    const alreadyFavorite = favoriteDoctorIds.has(doctorId)
    setActionLoading(true)
    try {
      if (alreadyFavorite) {
        await removeFavorite(doctorId)
        setFavoriteDoctorIds((prev) => {
          const next = new Set(prev)
          next.delete(doctorId)
          return next
        })
      } else {
        await addFavorite(doctorId)
        setFavoriteDoctorIds((prev) => new Set(prev).add(doctorId))
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateConsultation = async () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    if (!specialty) return

    // Si esta especialidad ya tiene una consulta en curso, la reanudamos.
    const current = openConsultations.find((item) => item.specialtyId === specialty.id)
    if (current) {
      navigate(`/consultation/${current.id}/chat`)
      return
    }
    // Las consultas abiertas de OTRAS especialidades no bloquean: cada área es
    // un caso aparte y aquí se puede iniciar una nueva con normalidad.

    setActionLoading(true)
    setConsultationNotice(null)
    try {
      const consultation = await createConsultation(specialty.id)
      navigate(`/consultation/${consultation.id}/chat`)
    } catch (error: unknown) {
      const requestError = error as {
        response?: { status?: number; data?: { detail?: unknown } }
      }
      const detail = requestError.response?.data?.detail

      // 409: ya hay una consulta en curso de ESTA especialidad; la reanudamos.
      if (requestError.response?.status === 409 && detail && typeof detail === 'object') {
        const payload = detail as { message?: string; consultation_id?: number }
        if (payload.consultation_id) {
          navigate(`/consultation/${payload.consultation_id}/chat`)
          return
        }
      }

      setConsultationNotice(
        typeof detail === 'string' ? detail : 'No se pudo iniciar la consulta. Intenta de nuevo.',
      )
      console.error('Error creating consultation:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const formatPrice = (pricePerMinCents: number) => formatMoney(pricePerMinCents)

  // Filtrado y ordenamiento de médicos (búsqueda por nombre/título + criterio).
  const visibleDoctors = useMemo(() => {
    const term = doctorSearch.trim().toLowerCase()
    const filtered = term
      ? doctors.filter(
          (doctor) =>
            doctor.display_name.toLowerCase().includes(term) ||
            (doctor.professional_title || '').toLowerCase().includes(term) ||
            (doctor.bio_short || '').toLowerCase().includes(term),
        )
      : doctors

    const sorted = [...filtered]
    const availabilityRank = (status?: string) =>
      status === 'online' ? 0 : status === 'busy' ? 1 : 2
    switch (doctorSort) {
      case 'availability':
        sorted.sort(
          (a, b) =>
            availabilityRank(a.presence?.status) - availabilityRank(b.presence?.status) ||
            Number(b.rating_avg) - Number(a.rating_avg) ||
            b.rating_count - a.rating_count,
        )
        break
      case 'name':
        sorted.sort((a, b) =>
          a.display_name.localeCompare(b.display_name, 'es', { sensitivity: 'base' }),
        )
        break
      case 'price_asc':
        sorted.sort((a, b) => a.price_per_min_cents - b.price_per_min_cents)
        break
      case 'price_desc':
        sorted.sort((a, b) => b.price_per_min_cents - a.price_per_min_cents)
        break
      case 'rating':
      default:
        sorted.sort(
          (a, b) =>
            Number(b.rating_avg) - Number(a.rating_avg) || b.rating_count - a.rating_count,
        )
        break
    }
    return sorted
  }, [doctors, doctorSearch, doctorSort])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    )
  }

  if (!specialty) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Especialidad no encontrada</p>
        <BackButton />
      </div>
    )
  }

  const currentOpen = openConsultations.find((item) => item.specialtyId === specialty.id) ?? null
  const otherOpen = openConsultations.filter((item) => item.specialtyId !== specialty.id)

  return (
    <div>
      <BackButton to="/specialties" label="Volver a especialidades" />

      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-800">{specialty.name}</h1>
              {specialty.is_top && (
                <span className="bg-primary-100 text-primary-700 text-sm px-3 py-1 rounded-full">
                  Destacada
                </span>
              )}
            </div>
          </div>
        </div>

        {specialty.description && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Descripción</h2>
            <p className="text-slate-600 leading-relaxed">{specialty.description}</p>
          </div>
        )}

        {specialty.keywords && specialty.keywords.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Palabras clave</h2>
            <div className="flex flex-wrap gap-2">
              {specialty.keywords.map((keyword, index) => (
                <span key={index} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 pt-6 mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleCreateConsultation}
              loading={actionLoading}
              leftIcon={<Calendar className="h-5 w-5" />}
            >
              {actionLoading ? 'Creando...' : currentOpen ? 'Continuar consulta IA' : 'Crear Consulta IA'}
            </Button>
          </div>

          {currentOpen && (
            <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-800">
              Tienes una consulta IA en curso de {specialty.name}. Al continuar, se reanudará donde la dejaste.
            </p>
          )}

          {otherOpen.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              También tienes{' '}
              {otherOpen.length === 1 ? 'una consulta IA abierta' : 'consultas IA abiertas'} de{' '}
              {otherOpen.map((item, index) => (
                <span key={item.id}>
                  {index > 0 && (index === otherOpen.length - 1 ? ' y ' : ', ')}
                  <Link
                    to={`/consultation/${item.id}/chat`}
                    className="font-medium text-slate-700 underline hover:text-primary-600"
                  >
                    {item.specialtyName ?? `especialidad #${item.specialtyId ?? '?'}`}
                  </Link>
                </span>
              ))}
              .
            </p>
          )}

          {consultationNotice && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              {consultationNotice}
            </p>
          )}

          {!isAuthenticated && (
            <p className="text-sm text-slate-500 mt-2">
              Debes iniciar sesión para crear una consulta o agregar a favoritos.
            </p>
          )}
        </div>
      </div>

      <div className="card mt-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-slate-800">Médicos disponibles</h2>
              <span className="text-sm font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                {visibleDoctors.length}
              </span>
            </div>
            <button type="button"
              onClick={handleRefreshDoctors}
              disabled={refreshingDoctors}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className={`w-4 h-4 ${refreshingDoctors ? 'animate-spin' : ''}`} />
              {refreshingDoctors ? 'Actualizando...' : 'Actualizar lista'}
            </button>
          </div>

          {doctors.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={doctorSearch}
                  onChange={(event) => setDoctorSearch(event.target.value)}
                  placeholder="Buscar por nombre o título..."
                  aria-label="Buscar médicos"
                  className="input-field pl-10"
                />
              </div>
              <div className="sm:w-60">
                <label
                  htmlFor="doctor-sort"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Ordenar por
                </label>
                <select
                  id="doctor-sort"
                  value={doctorSort}
                  onChange={(event) => setDoctorSort(event.target.value as DoctorSort)}
                  className="input-field"
                >
                  <option value="availability">Disponibilidad</option>
                  <option value="rating">Mejor valoración</option>
                  <option value="name">Nombre (A–Z)</option>
                  <option value="price_asc">Menor costo por minuto</option>
                  <option value="price_desc">Mayor costo por minuto</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {doctors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-slate-500 text-center">
            Aún no hay médicos cargados para esta especialidad.
          </div>
        ) : visibleDoctors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-slate-500 text-center">
            No encontramos médicos que coincidan con «{doctorSearch}». Prueba con otro término.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleDoctors.map((doctor) => (
              <div key={doctor.id} className="relative">
                <Link
                  to={`/doctors/${doctor.id}?specialty=${specialty.slug}${consultationId ? `&consultation=${consultationId}` : ''}`}
                  className="group block w-full rounded-2xl border border-slate-200 p-5 pr-16 text-left transition-all hover:border-primary-400 hover:shadow-sm"
                >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <h3 className="text-xl font-semibold text-slate-800">{doctor.display_name}</h3>
                  <PresenceBadge presence={doctor.presence} />
                </div>

                  <p className="text-slate-600">{doctor.bio_short || 'Sin descripción corta disponible.'}</p>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-700">
                    <div className="flex flex-wrap items-center gap-5">
                      {doctor.rating_count > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          {Number(doctor.rating_avg).toFixed(1)}
                          <span className="text-slate-500">({doctor.rating_count} reseñas)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <Star className="w-4 h-4 text-slate-300" />
                          Sin reseñas aún
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <CircleDollarSign className="w-4 h-4 text-emerald-600" />
                        <span className="font-medium">{formatPrice(doctor.price_per_min_cents)}</span>/min
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 font-medium text-primary-600 group-hover:gap-2 transition-all">
                      Ver perfil y agendar
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
                {isAuthenticated && (
                  <DoctorFavoriteButton
                    doctorId={doctor.id}
                    active={favoriteDoctorIds.has(doctor.id)}
                    onToggle={handleToggleDoctorFavorite}
                    disabled={actionLoading}
                    className="absolute right-4 top-4"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
