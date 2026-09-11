import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Star, Calendar, Loader2, Video, Clock3, CircleDollarSign } from 'lucide-react'
import { getSpecialtyBySlug, Specialty } from '../api/specialties'
import { createConsultation, prepareVideoSession, VideoSessionPrepareResponse } from '../api/consultations'
import { addFavorite, removeFavorite, getMyFavorites } from '../api/favorites'
import { DoctorCard, getDoctorsBySpecialty } from '../api/doctors'
import { useAuth } from '../context/AuthContext'
import BackButton from '../components/BackButton'

export default function SpecialtyDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  
  const [specialty, setSpecialty] = useState<Specialty | null>(null)
  const [doctors, setDoctors] = useState<DoctorCard[]>([])
  const [loading, setLoading] = useState(true)
  const [isFavorite, setIsFavorite] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [doctorLoading, setDoctorLoading] = useState(false)
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null)
  const [estimatedMinutes, setEstimatedMinutes] = useState('20')
  const [videoSession, setVideoSession] = useState<VideoSessionPrepareResponse | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)

  useEffect(() => {
    const loadSpecialty = async () => {
      if (!slug) return
      
      try {
        const data = await getSpecialtyBySlug(slug)
        setSpecialty(data)
        const doctorsData = await getDoctorsBySpecialty(slug)
        setDoctors(doctorsData.doctors)
        
        if (isAuthenticated) {
          const favorites = await getMyFavorites()
          setIsFavorite(favorites.favorites.some(f => f.specialty_id === data.id))
        }
      } catch (error) {
        console.error('Error loading specialty:', error)
      } finally {
        setLoading(false)
      }
    }
    loadSpecialty()
  }, [slug, isAuthenticated])

  const handleToggleFavorite = async () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    
    if (!specialty) return
    
    setActionLoading(true)
    try {
      if (isFavorite) {
        await removeFavorite(specialty.id)
        setIsFavorite(false)
      } else {
        await addFavorite(specialty.id)
        setIsFavorite(true)
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
    
    setActionLoading(true)
    try {
      const consultation = await createConsultation(specialty.id)
      navigate(`/consultation/${consultation.id}/chat`)
    } catch (error) {
      console.error('Error creating consultation:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handlePrepareVideoSession = async () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    if (!specialty || !selectedDoctorId) {
      setVideoError('Selecciona un médico antes de preparar la videoconsulta.')
      return
    }

    setDoctorLoading(true)
    setVideoError(null)
    try {
      const consultation = await createConsultation(specialty.id)
      const prepared = await prepareVideoSession(consultation.id, {
        doctor_id: selectedDoctorId,
        estimated_minutes: Number(estimatedMinutes) || 20,
      })
      setVideoSession(prepared)
      const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId)
      sessionStorage.setItem(
        'sabiodoc-video-session',
        JSON.stringify({
          ...prepared,
          consultation_id: consultation.id,
          specialty_name: specialty.name,
          doctor_name: selectedDoctor?.display_name || 'Especialista',
          participant_token: prepared.patient_token,
          participant_role: 'patient',
        })
      )
      navigate('/video-room')
    } catch (error: any) {
      console.error('Error preparing video session:', error)
      setVideoError(error.response?.data?.detail || 'No se pudo preparar la videoconsulta.')
    } finally {
      setDoctorLoading(false)
    }
  }

  const formatPrice = (pricePerMinCents: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(pricePerMinCents / 100)

  const getPresenceBadge = (doctor: DoctorCard) => {
    if (doctor.presence.status === 'online') {
      return { dot: 'bg-green-500', pill: 'bg-green-50 text-green-700 border-green-200' }
    }
    if (doctor.presence.status === 'busy') {
      return { dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700 border-amber-200' }
    }
    return { dot: 'bg-red-500', pill: 'bg-red-50 text-red-700 border-red-200' }
  }

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
        <p className="text-gray-500">Especialidad no encontrada</p>
        <BackButton />
      </div>
    )
  }

  return (
    <div>
      <BackButton to="/specialties" label="Volver a especialidades" />
      
      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-800">{specialty.name}</h1>
              {specialty.is_top && (
                <span className="bg-primary-100 text-primary-700 text-sm px-3 py-1 rounded-full">
                  Destacada
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={handleToggleFavorite}
            disabled={actionLoading}
            className={`p-3 rounded-full transition-colors ${
              isFavorite 
                ? 'bg-yellow-100 text-yellow-500 hover:bg-yellow-200' 
                : 'bg-gray-100 text-gray-400 hover:bg-yellow-100 hover:text-yellow-500'
            }`}
          >
            <Star className={`w-6 h-6 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        {specialty.description && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Descripción</h2>
            <p className="text-gray-600 leading-relaxed">{specialty.description}</p>
          </div>
        )}

        {specialty.keywords && specialty.keywords.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Palabras clave</h2>
            <div className="flex flex-wrap gap-2">
              {specialty.keywords.map((keyword, index) => (
                <span 
                  key={index}
                  className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-100 pt-6 mt-6">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleCreateConsultation}
              disabled={actionLoading}
              className="btn-primary flex items-center gap-2"
            >
              <Calendar className="w-5 h-5" />
              {actionLoading ? 'Creando...' : 'Crear Consulta IA'}
            </button>
          </div>
          
          {!isAuthenticated && (
            <p className="text-sm text-gray-500 mt-2">
              Debes iniciar sesión para crear una consulta o agregar a favoritos.
            </p>
          )}
        </div>
      </div>

      <div className="card mt-6">
        {/* CABECERA CON EL INPUT GLOBAL DE MINUTOS */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-gray-800">Médicos disponibles</h2>
              <span className="text-sm font-medium bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                {doctors.length}
              </span>
            </div>
            <p className="text-gray-600 mt-2">
              Elige un médico para preparar la videoconsulta con prepago estimado.
            </p>
          </div>
          
          {/* Mostramos el input solo si hay médicos */}
          {doctors.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minutos estimados de consulta
              </label>
              <input
                type="number"
                min="1"
                max="180"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                className="input-field w-full"
              />
            </div>
          )}
        </div>

        {doctors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-gray-500 text-center">
            Aún no hay médicos cargados para esta especialidad.
          </div>
        ) : (
          <div className="space-y-4">
            {doctors.map((doctor) => {
              const badge = getPresenceBadge(doctor)
              const isSelected = selectedDoctorId === doctor.id
              return (
                <button
                  key={doctor.id}
                  type="button"
                  onClick={() => setSelectedDoctorId(doctor.id)}
                  className={`w-full rounded-2xl border p-5 text-left transition-all ${
                    isSelected ? 'border-primary-500 bg-primary-50 shadow-sm' : 'border-gray-200 hover:border-primary-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-800">{doctor.display_name}</h3>
                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${badge.pill}`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${badge.dot}`} />
                      {doctor.presence.status_message || doctor.presence.status}
                    </span>
                  </div>
                  
                  <p className="text-gray-600">
                    {doctor.bio_short || 'Sin descripción corta disponible.'}
                  </p>
                  
                  <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-gray-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      {Number(doctor.rating_avg).toFixed(1)} <span className="text-gray-500">({doctor.rating_count} reseñas)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CircleDollarSign className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium">{formatPrice(doctor.price_per_min_cents)}</span>/min
                    </span>
                    
                    {/* El total se calcula dinámicamente según el input global */}
                    <span className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                      <Clock3 className="w-4 h-4 text-sky-600" />
                      Prepago estimado: <span className="font-semibold text-sky-700">{formatPrice((Number(estimatedMinutes) || 20) * doctor.price_per_min_cents)}</span>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-6 border-t border-gray-100 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePrepareVideoSession}
              disabled={!selectedDoctorId || doctorLoading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {doctorLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Video className="w-5 h-5" />}
              {doctorLoading ? 'Preparando sala...' : 'Preparar videoconsulta'}
            </button>
            <p className="text-sm text-gray-500">
              Se crea una consulta, se reserva el prepago y se genera una sala privada de Daily.
            </p>
          </div>

          {videoError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {videoError}
            </div>
          )}

          {videoSession && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <h3 className="text-lg font-semibold text-emerald-800">Videoconsulta preparada</h3>
              <div className="mt-3 grid gap-3 text-sm text-emerald-900 md:grid-cols-2">
                <p><span className="font-medium">Sala:</span> {videoSession.room_name}</p>
                <p><span className="font-medium">Proveedor:</span> {videoSession.provider}</p>
                <p><span className="font-medium">Prepago:</span> {formatPrice(videoSession.prepaid_amount_cents)}</p>
                <p><span className="font-medium">Estado de pago:</span> {videoSession.payment_status}</p>
              </div>
              {videoSession.room_url && (
                <a
                  href={videoSession.room_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
                >
                  <Video className="w-4 h-4" />
                  Abrir sala de prueba
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}