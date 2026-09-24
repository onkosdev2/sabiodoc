import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Award,
  CalendarPlus,
  CircleDollarSign,
  Loader2,
  MapPin,
  MessageSquareQuote,
  Star,
} from 'lucide-react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

import BackButton from '../components/BackButton'
import PresenceBadge from '../components/PresenceBadge'
import DoctorFavoriteButton from '../components/DoctorFavoriteButton'
import { addFavorite, removeFavorite, getMyFavorites } from '../api/favorites'
import { Select, Textarea } from '../components/ui/Field'
import { DoctorDetail, getDoctorDetail } from '../api/doctors'
import {
  BookableSlot,
  createAppointment,
  getDoctorBookableSlots,
} from '../api/appointments'
import { useAuth } from '../context/AuthContext'
import { getMyWallet, Wallet } from '../api/wallet'
import { getApiErrorMessage } from '../utils/apiError'
import { formatMoney as currency } from '../utils/format'

function Stars({ value, className = 'h-4 w-4' }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${className} ${star <= Math.round(value) ? 'fill-current text-amber-400' : 'text-slate-300'}`}
        />
      ))}
    </span>
  )
}

export default function DoctorDetailPage() {
  const { doctorId } = useParams<{ doctorId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [doctor, setDoctor] = useState<DoctorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [slots, setSlots] = useState<BookableSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [patientNote, setPatientNote] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedOvertime, setAcceptedOvertime] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState('30')
  const [booking, setBooking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteBusy, setFavoriteBusy] = useState(false)

  const requestedSlug = searchParams.get('specialty')
  const consultationId = searchParams.get('consultation')
  const duration = Math.min(120, Math.max(15, Number(durationMinutes) || 30))
  const selectedSpecialty = useMemo(() => {
    if (!doctor) return null
    return (
      doctor.specialties.find((item) => item.slug === requestedSlug) ||
      doctor.specialties[0] ||
      null
    )
  }, [doctor, requestedSlug])

  useEffect(() => {
    const load = async () => {
      if (!doctorId) return
      setLoading(true)
      setLoadError(null)
      try {
        const detail = await getDoctorDetail(Number(doctorId))
        setDoctor(detail)
      } catch (err: unknown) {
        const requestError = err as { response?: { data?: { detail?: string } } }
        setLoadError(requestError.response?.data?.detail || 'No se pudo cargar el perfil del médico')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [doctorId])

  useEffect(() => {
    if (!isAuthenticated) return
    let active = true
    getMyWallet()
      .then((data) => {
        if (active) setWallet(data)
      })
      .catch(() => {
        if (active) setWallet(null)
      })
    return () => {
      active = false
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || !doctor) return
    let active = true
    getMyFavorites()
      .then((data) => {
        if (active) setIsFavorite(data.favorites.some((fav) => fav.doctor_id === doctor.id))
      })
      .catch(() => {
        if (active) setIsFavorite(false)
      })
    return () => {
      active = false
    }
  }, [isAuthenticated, doctor])

  const handleToggleFavorite = async (doctorId: number) => {
    setFavoriteBusy(true)
    try {
      if (isFavorite) {
        await removeFavorite(doctorId)
        setIsFavorite(false)
      } else {
        await addFavorite(doctorId)
        setIsFavorite(true)
      }
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'No se pudo actualizar favoritos.'))
    } finally {
      setFavoriteBusy(false)
    }
  }

  useEffect(() => {
    const loadSlots = async () => {
      if (!doctor || !doctor.is_accepting_consultations) return
      setSlotsLoading(true)
      try {
        const response = await getDoctorBookableSlots(doctor.id, 14, duration)
        setSlots(response.slots)
        if (response.slots.length > 0) {
          setSelectedSlot(response.slots[0].starts_at)
        }
      } catch {
        setSlots([])
      } finally {
        setSlotsLoading(false)
      }
    }
    loadSlots()
  }, [doctor, duration])

  const groupedSlots = useMemo(() => {
    return slots.reduce<Record<string, BookableSlot[]>>((accumulator, slot) => {
      const key = new Date(slot.starts_at).toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
      accumulator[key] = accumulator[key] || []
      accumulator[key].push(slot)
      return accumulator
    }, {})
  }, [slots])

  const ratingAverage = doctor ? Number(doctor.rating_avg) : 0

  const handleBook = async () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (!doctor || !selectedSpecialty || !selectedSlot) return

    setBooking(true)
    setActionError(null)
    try {
      await createAppointment({
        doctor_id: doctor.id,
        specialty_id: selectedSpecialty.id,
        consultation_id: consultationId ? Number(consultationId) : undefined,
        scheduled_at: selectedSlot,
        duration_minutes: duration,
        patient_note: patientNote.trim() || undefined,
        accepted_terms: acceptedTerms,
        accepted_overtime_terms: acceptedOvertime,
        consent_text_version: 'v1',
      })
      navigate('/me/appointments')
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, 'No se pudo agendar la cita'))
    } finally {
      setBooking(false)
    }
  }

  const totalCents = doctor ? duration * doctor.price_per_min_cents : 0
  const hasEnoughCredits = wallet === null || wallet.balance_cents >= totalCents

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Cargando perfil del médico...
      </div>
    )
  }

  if (loadError || !doctor) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <BackButton to="/specialties" label="Volver a especialidades" />
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-red-700">
          {loadError || 'Médico no encontrado'}
        </div>
      </div>
    )
  }

  const initials = doctor.display_name
    .replace(/^(Dr\.|Dra\.|Lic\.|Psic\.|Odont\.)\s*/i, '')
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  const backTo = selectedSpecialty ? `/specialties/${selectedSpecialty.slug}` : '/specialties'

  return (
    <div className="space-y-6">
      <BackButton to={backTo} label="Volver a especialidades" />

      {/* Cabecera del médico */}
      <Card as="section" className="sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex h-20 w-20 flex-none items-center justify-center rounded-2xl bg-primary-100 text-2xl font-bold text-primary-700">
            {initials || 'MD'}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">{doctor.display_name}</h1>
              <PresenceBadge presence={doctor.presence} />
              {isAuthenticated && (
                <DoctorFavoriteButton
                  doctorId={doctor.id}
                  active={isFavorite}
                  onToggle={handleToggleFavorite}
                  disabled={favoriteBusy}
                />
              )}
            </div>

            <p className="mt-1 text-lg text-slate-600">{doctor.professional_title || 'Profesional médico'}</p>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-700">
              {doctor.rating_count > 0 ? (
                <span className="inline-flex items-center gap-2">
                  <Stars value={ratingAverage} />
                  <span className="font-semibold text-slate-900">{ratingAverage.toFixed(1)}</span>
                  <span className="text-slate-500">({doctor.rating_count} valoraciones)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <Star className="h-4 w-4 text-slate-300" />
                  Sin valoraciones todavía
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CircleDollarSign className="h-4 w-4 text-emerald-600" />
                <span className="font-medium">{currency(doctor.price_per_min_cents)}</span>/min
              </span>
              {doctor.years_experience != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-sky-600" />
                  {doctor.years_experience} años de experiencia
                </span>
              )}
              {(doctor.city || doctor.country) && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-rose-500" />
                  {[doctor.city, doctor.country].filter(Boolean).join(', ')}
                </span>
              )}
            </div>

            {doctor.specialties.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {doctor.specialties.map((specialty) => (
                  <span
                    key={specialty.id}
                    className={`rounded-full px-3 py-1 text-sm ${
                      specialty.id === selectedSpecialty?.id
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {specialty.name}
                  </span>
                ))}
              </div>
            )}

            {doctor.bio_short && (
              <p className="mt-4 leading-relaxed text-slate-600">{doctor.bio_short}</p>
            )}
          </div>
        </div>
      </Card>

      {!isAuthenticated && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sky-900 sm:flex-row sm:items-center">
          <p className="text-sm">Inicia sesión para agendar una cita o iniciar una videoconsulta con este médico.</p>
          <Link to="/login" className="btn-primary inline-flex flex-none items-center gap-2">
            Iniciar sesión
          </Link>
        </div>
      )}

      {actionError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{actionError}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Reseñas */}
        <Card as="section" className="sm:p-8">
          <div className="flex items-center gap-3">
            <MessageSquareQuote className="h-6 w-6 text-primary-600" />
            <h2 className="text-2xl font-semibold text-slate-900">Reseñas de pacientes</h2>
          </div>

          <div className="mt-6 space-y-4">
            {doctor.reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-slate-500">
                Aún no hay reseñas escritas. Las valoraciones se generan al completar una cita con el médico.
              </div>
            ) : (
              doctor.reviews.map((review) => (
                <article key={review.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Stars value={review.rating} />
                    <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {new Date(review.created_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {review.comment && <p className="mt-3 leading-relaxed text-slate-700">{review.comment}</p>}
                  <p className="mt-3 text-sm font-medium text-slate-500">{review.patient_label}</p>
                </article>
              ))
            )}
          </div>
        </Card>

        {/* Acciones: agendar o videoconsulta inmediata */}
        <aside className="space-y-6">
          <Card as="section">
            <h2 className="text-xl font-semibold text-slate-900">Agendar una cita</h2>
            <p className="mt-1 text-sm text-slate-600">Elige un horario disponible en la agenda del médico.</p>

            <div className="mt-4">
              <Select
                label="Duración de la cita"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
              >
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
                <option value="45">45 minutos</option>
                <option value="60">60 minutos</option>
              </Select>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm">
              <span className="text-emerald-800">Total a pagar</span>
              <span className="font-semibold text-emerald-700">
                {currency(totalCents)}
              </span>
            </div>

            {isAuthenticated && wallet && (
              <div
                className={`mt-2 flex items-center justify-between rounded-2xl px-4 py-3 text-sm ${
                  hasEnoughCredits ? 'bg-slate-50 text-slate-700' : 'bg-rose-50 text-rose-800'
                }`}
              >
                <span>Saldo disponible</span>
                <span className="font-semibold">{currency(wallet.balance_cents)}</span>
              </div>
            )}

            {isAuthenticated && !hasEnoughCredits && (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                No tienes créditos suficientes para esta cita.{' '}
                <Link to="/me/wallet" className="font-semibold underline">
                  Recargar créditos
                </Link>
              </div>
            )}

            {!doctor.is_accepting_consultations ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Este médico no está aceptando nuevas citas por ahora.
              </div>
            ) : slotsLoading ? (
              <div className="mt-4 flex items-center justify-center py-8 text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando disponibilidad...
              </div>
            ) : slots.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                No hay horarios disponibles en los próximos días.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                  {Object.entries(groupedSlots).map(([day, daySlots]) => (
                    <div key={day}>
                      <p className="text-sm font-semibold capitalize text-slate-900">{day}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {daySlots.map((slot) => (
                          <button
                            key={slot.starts_at}
                            type="button"
                            onClick={() => setSelectedSlot(slot.starts_at)}
                            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                              selectedSlot === slot.starts_at
                                ? 'bg-primary-600 text-white'
                                : 'border border-slate-300 bg-white text-slate-700 hover:border-primary-400'
                            }`}
                          >
                            {new Date(slot.starts_at).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Textarea
                  label="Nota para el médico (opcional)"
                  value={patientNote}
                  onChange={(event) => setPatientNote(event.target.value)}
                  className="min-h-24"
                  placeholder="Comparte lo que consideres relevante antes de la cita."
                />

                <label className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-3 text-xs text-sky-900">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Acepto el consentimiento de videoconsulta y el tratamiento de mis datos clínicos.
                  </span>
                </label>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">Recomendación: ten créditos excedentes</p>
                  <p className="mt-1">
                    Si la consulta se extiende más allá del tiempo reservado, se consumirán créditos
                    adicionales ({currency(doctor.price_per_min_cents)}/min). Te recomendamos tener saldo
                    extra para evitar que la videollamada se corte automáticamente.
                  </p>
                  <label className="mt-2 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={acceptedOvertime}
                      onChange={(event) => setAcceptedOvertime(event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Entiendo que si la consulta se prolonga se cobrarán créditos extra y que, si me
                      quedo sin saldo, la videollamada finalizará automáticamente.
                    </span>
                  </label>
                </div>

                <Button
                  onClick={handleBook}
                  disabled={
                    !selectedSlot || booking || !acceptedTerms || !acceptedOvertime || !hasEnoughCredits
                  }
                  loading={booking}
                  leftIcon={<CalendarPlus className="h-4 w-4" />}
                  className="w-full"
                >
                  Confirmar cita
                </Button>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  )
}
