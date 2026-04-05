import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ClipboardList, Loader2 } from 'lucide-react'

import BackButton from '../components/BackButton'
import { registerDoctor } from '../api/auth'
import { getSpecialties, Specialty } from '../api/specialties'
import { getMyDoctorApplication, updateMyDoctorProfile } from '../api/doctors'
import { useAuth } from '../context/AuthContext'

const centsToDisplay = (value: number) => (value / 100).toFixed(2)

export default function DoctorOnboarding() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading: authLoading, login: authLogin } = useAuth()

  const isDoctorEditing = isAuthenticated && user?.role === 'doctor'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [professionalTitle, setProfessionalTitle] = useState('')
  const [bioShort, setBioShort] = useState('')
  const [pricePerMinute, setPricePerMinute] = useState('22.00')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [licenseCountry, setLicenseCountry] = useState('Colombia')
  const [country, setCountry] = useState('Colombia')
  const [city, setCity] = useState('')
  const [doctorTimezone, setDoctorTimezone] = useState('America/Bogota')
  const [governmentId, setGovernmentId] = useState('')
  const [yearsExperience, setYearsExperience] = useState('5')
  const [selectedSpecialties, setSelectedSpecialties] = useState<number[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const bootstrap = async () => {
      try {
        const specialtiesResponse = await getSpecialties()
        if (!mounted) {
          return
        }
        setSpecialties(specialtiesResponse.specialties)

        if (isDoctorEditing) {
          const application = await getMyDoctorApplication()
          if (!mounted) {
            return
          }
          setEmail(application.email)
          setDisplayName(application.display_name)
          setProfessionalTitle(application.professional_title || '')
          setBioShort(application.bio_short || '')
          setPricePerMinute(centsToDisplay(application.price_per_min_cents))
          setLicenseNumber(application.license_number || '')
          setLicenseCountry(application.license_country || 'Colombia')
          setCountry(application.country || 'Colombia')
          setCity(application.city || '')
          setDoctorTimezone(application.timezone || 'America/Bogota')
          setGovernmentId(application.government_id || '')
          setYearsExperience(String(application.years_experience ?? 0))
          setSelectedSpecialties(application.specialties.map((specialty) => specialty.id))
        }
      } catch (err: unknown) {
        const requestError = err as { response?: { data?: { detail?: string } } }
        if (mounted) {
          setError(requestError.response?.data?.detail || 'No se pudo cargar el onboarding médico')
        }
      } finally {
        if (mounted) {
          setIsBootstrapping(false)
        }
      }
    }

    if (!authLoading) {
      bootstrap()
    }

    return () => {
      mounted = false
    }
  }, [authLoading, isDoctorEditing])

  const parsedPricePerMinCents = useMemo(() => {
    const normalized = pricePerMinute.replace(',', '.').trim()
    const parsed = Number(normalized)
    if (Number.isNaN(parsed)) {
      return null
    }
    return Math.round(parsed * 100)
  }, [pricePerMinute])

  const parsedYearsExperience = useMemo(() => {
    const parsed = Number(yearsExperience)
    if (Number.isNaN(parsed)) {
      return null
    }
    return Math.round(parsed)
  }, [yearsExperience])

  const toggleSpecialty = (specialtyId: number) => {
    setSelectedSpecialties((current) =>
      current.includes(specialtyId)
        ? current.filter((id) => id !== specialtyId)
        : [...current, specialtyId]
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (selectedSpecialties.length === 0) {
      setError('Selecciona al menos una especialidad')
      return
    }

    if (parsedPricePerMinCents === null || parsedPricePerMinCents <= 0) {
      setError('Ingresa un costo por minuto válido')
      return
    }

    if (parsedYearsExperience === null || parsedYearsExperience < 0) {
      setError('Ingresa años de experiencia válidos')
      return
    }

    if (!isDoctorEditing) {
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres')
        return
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden')
        return
      }
    }

    setIsSubmitting(true)

    try {
      if (isDoctorEditing) {
        await updateMyDoctorProfile({
          display_name: displayName,
          professional_title: professionalTitle,
          bio_short: bioShort,
          price_per_min_cents: parsedPricePerMinCents,
          license_number: licenseNumber,
          license_country: licenseCountry,
          country,
          city,
          timezone: doctorTimezone,
          government_id: governmentId,
          years_experience: parsedYearsExperience,
          specialty_ids: selectedSpecialties,
        })
        setSuccess('Tu perfil médico fue actualizado. Seguimos mostrándolo en revisión hasta la aprobación.')
        navigate('/doctor/pending')
      } else {
        const response = await registerDoctor({
          email,
          password,
          display_name: displayName,
          professional_title: professionalTitle,
          bio_short: bioShort,
          price_per_min_cents: parsedPricePerMinCents,
          license_number: licenseNumber,
          license_country: licenseCountry,
          country,
          city,
          timezone: doctorTimezone,
          government_id: governmentId,
          years_experience: parsedYearsExperience,
          specialty_ids: selectedSpecialties,
        })
        authLogin(response.access_token, response.user)
        navigate('/doctor/pending')
      }
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { detail?: string } } }
      setError(requestError.response?.data?.detail || 'No se pudo enviar la postulación médica')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!authLoading && isAuthenticated && user?.role === 'patient') {
    return <Navigate to="/" replace />
  }

  if (!authLoading && isAuthenticated && user?.role === 'doctor' && user.doctor_status === 'approved') {
    return <Navigate to="/doctor" replace />
  }

  return (
    <div className="mx-auto max-w-4xl">
      <BackButton />

      <div className="card">
        <div className="mb-8 flex items-start gap-4">
          <div className="rounded-2xl bg-primary-100 p-3">
            <ClipboardList className="h-8 w-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isDoctorEditing ? 'Actualizar onboarding médico' : 'Postular como médico'}
            </h1>
            <p className="mt-2 text-gray-600">
              Este formulario crea o actualiza tu perfil profesional. SabioDoc lo deja en revisión antes de habilitar el panel médico y la videoconsulta.
            </p>
          </div>
        </div>

        {isBootstrapping ? (
          <div className="flex min-h-[220px] items-center justify-center text-gray-500">
            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
            Cargando formulario médico...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {!isDoctorEditing && (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block font-medium text-gray-700">Email profesional</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="input-field"
                    required
                    placeholder="medico@clinica.com"
                  />
                </div>
                <div>
                  <label className="mb-2 block font-medium text-gray-700">Nombre para pacientes</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="input-field"
                    required
                    minLength={3}
                    placeholder="Dra. Ana Pérez"
                  />
                </div>
                <div>
                  <label className="mb-2 block font-medium text-gray-700">Título profesional</label>
                  <input
                    type="text"
                    value={professionalTitle}
                    onChange={(event) => setProfessionalTitle(event.target.value)}
                    className="input-field"
                    required
                    minLength={2}
                    placeholder="Cardióloga clínica"
                  />
                </div>
              </div>
            )}

            {isDoctorEditing && (
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <label className="mb-2 block font-medium text-gray-700">Email profesional</label>
                  <input type="email" value={email} disabled className="input-field cursor-not-allowed bg-gray-100" />
                </div>
                <div>
                  <label className="mb-2 block font-medium text-gray-700">Nombre para pacientes</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="input-field"
                    required
                    minLength={3}
                  />
                </div>
                <div>
                  <label className="mb-2 block font-medium text-gray-700">Título profesional</label>
                  <input
                    type="text"
                    value={professionalTitle}
                    onChange={(event) => setProfessionalTitle(event.target.value)}
                    className="input-field"
                    required
                    minLength={2}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {!isDoctorEditing && (
                <>
                  <div>
                    <label className="mb-2 block font-medium text-gray-700">Contraseña</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="input-field"
                      required
                      minLength={6}
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block font-medium text-gray-700">Confirmar contraseña</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="input-field"
                      required
                      minLength={6}
                      placeholder="••••••••"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-2 block font-medium text-gray-700">Costo por minuto (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="5"
                  max="300"
                  value={pricePerMinute}
                  onChange={(event) => setPricePerMinute(event.target.value)}
                  className="input-field"
                  required
                  placeholder="22.00"
                />
                <p className="mt-1 text-xs text-gray-500">Rango operativo actual: US$5.00 a US$300.00 por minuto.</p>
              </div>
              <div>
                <label className="mb-2 block font-medium text-gray-700">Años de experiencia</label>
                <input
                  type="number"
                  min="0"
                  max="80"
                  value={yearsExperience}
                  onChange={(event) => setYearsExperience(event.target.value)}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-2 block font-medium text-gray-700">Número de licencia</label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(event) => setLicenseNumber(event.target.value)}
                  className="input-field"
                  required
                  placeholder="COL-CARD-1001"
                />
              </div>
              <div>
                <label className="mb-2 block font-medium text-gray-700">País de licencia</label>
                <input
                  type="text"
                  value={licenseCountry}
                  onChange={(event) => setLicenseCountry(event.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block font-medium text-gray-700">Documento</label>
                <input
                  type="text"
                  value={governmentId}
                  onChange={(event) => setGovernmentId(event.target.value)}
                  className="input-field"
                  required
                  placeholder="CC-12345678"
                />
              </div>
              <div>
                <label className="mb-2 block font-medium text-gray-700">País</label>
                <input
                  type="text"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block font-medium text-gray-700">Ciudad</label>
                <input
                  type="text"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block font-medium text-gray-700">Zona horaria</label>
                <input
                  type="text"
                  value={doctorTimezone}
                  onChange={(event) => setDoctorTimezone(event.target.value)}
                  className="input-field"
                  required
                  placeholder="America/Bogota"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block font-medium text-gray-700">Descripción corta</label>
              <textarea
                value={bioShort}
                onChange={(event) => setBioShort(event.target.value)}
                className="input-field min-h-32"
                maxLength={500}
                placeholder="Resume tu enfoque clínico, tipo de casos y tono de atención."
              />
              <p className="mt-1 text-xs text-gray-500">{bioShort.length}/500 caracteres</p>
            </div>

            <div>
              <label className="mb-3 block font-medium text-gray-700">Especialidades</label>
              <div className="grid gap-3 md:grid-cols-2">
                {specialties.map((specialty) => {
                  const selected = selectedSpecialties.includes(specialty.id)
                  return (
                    <label
                      key={specialty.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                        selected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-primary-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSpecialty(specialty.id)}
                        className="mt-1 h-4 w-4"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{specialty.name}</p>
                        <p className="text-sm text-gray-500">{specialty.description || specialty.slug}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
                {success}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-500">
                Al enviar, tu acceso al panel médico queda sujeto a revisión.
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary inline-flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  isDoctorEditing ? 'Actualizar postulación' : 'Enviar postulación'
                )}
              </button>
            </div>
          </form>
        )}

        {!isDoctorEditing && (
          <p className="mt-8 text-center text-sm text-gray-600">
            ¿Ya tienes cuenta médica?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:underline">
              Inicia sesión
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
