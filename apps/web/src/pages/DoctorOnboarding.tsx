import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ClipboardList, Loader2, ChevronRight, ChevronLeft, Check, Camera, Trash2 } from 'lucide-react'
import { Country, getCitiesOfCountry } from '../utils/locations'

import BackButton from '../components/BackButton'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import { Field, Input, PasswordInput, Select, Textarea } from '../components/ui/Field'
import { registerDoctor } from '../api/auth'
import { getSpecialties, Specialty } from '../api/specialties'
import { getMyDoctorApplication, updateMyDoctorProfile, uploadMyDoctorPhoto, deleteMyDoctorPhoto } from '../api/doctors'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../utils/apiError'

const centsToDisplay = (value: number) => (value / 100).toFixed(2)

// Zonas horarias nativas
const timezones: string[] = (Intl as any).supportedValuesOf 
  ? (Intl as any).supportedValuesOf('timeZone') 
  : ['America/Lima', 'America/Bogota', 'America/Mexico_City', 'Europe/Madrid']

// Diccionario de documentos por ISO de país
interface CountryDocs {
  idTypes: string[]
  licenseTypes: string[]
  // Registro nacional de la especialidad (equivalente a la licencia, pero de la especialidad).
  specialistRegistryTypes: string[]
  specialistRegistryLabel: string
}

const DOC_DATA: Record<string, CountryDocs> = {
  'PE': {
    idTypes: ['DNI', 'CE', 'Pasaporte', 'Otro'],
    licenseTypes: ['CMP', 'COP', 'CEP', 'CBP', 'Otro'],
    specialistRegistryTypes: ['RNE', 'Otro'],
    specialistRegistryLabel: 'Registro Nacional de Especialistas (RNE)',
  },
  'CO': {
    idTypes: ['CC', 'CE', 'Pasaporte', 'Otro'],
    licenseTypes: ['ReTHUS', 'Otro'],
    specialistRegistryTypes: ['Registro de Especialidad', 'Otro'],
    specialistRegistryLabel: 'Registro de Especialidad',
  },
  'MX': {
    idTypes: ['INE', 'Pasaporte', 'Otro'],
    licenseTypes: ['Cédula Prof.', 'Otro'],
    specialistRegistryTypes: ['Cédula de Especialidad', 'Otro'],
    specialistRegistryLabel: 'Cédula de Especialidad',
  },
  'CL': {
    idTypes: ['RUT', 'Pasaporte', 'Otro'],
    licenseTypes: ['Superintendencia', 'Otro'],
    specialistRegistryTypes: ['RNPI', 'Otro'],
    specialistRegistryLabel: 'Registro Nacional de Prestadores Individuales (RNPI)',
  },
  'DEFAULT': {
    idTypes: ['ID', 'Pasaporte', 'Otro'],
    licenseTypes: ['Licencia Médica', 'Otro'],
    specialistRegistryTypes: ['Registro de Especialista', 'Otro'],
    specialistRegistryLabel: 'Registro de Especialista',
  },
}

const getCountryDocs = (iso: string): CountryDocs => DOC_DATA[iso] || DOC_DATA['DEFAULT']

export default function DoctorOnboarding() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated, isLoading: authLoading, login: authLogin, refreshUser } = useAuth()
  const isDoctorEditing = isAuthenticated && !!user?.doctor_status

  const allCountries = Country.getAllCountries()

  // --- Estados del Formulario (Paso 1) ---
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [namePrefix, setNamePrefix] = useState('Dr.')
  const [baseName, setBaseName] = useState('')
  
  const [countryIso, setCountryIso] = useState('PE')
  const [cityName, setCityName] = useState('Lima')
  const [customCity, setCustomCity] = useState('') 
  
  const [doctorTimezone, setDoctorTimezone] = useState('America/Lima')


  // --- Estados del Formulario (Paso 2) ---
  const [professionalTitle, setProfessionalTitle] = useState('')
  const [yearsExperience, setYearsExperience] = useState('5')
  const [bioShort, setBioShort] = useState('')
  const [selectedSpecialties, setSelectedSpecialties] = useState<number[]>([])

  // --- Estados del Formulario (Paso 3) ---
  const [pricePerMinute, setPricePerMinute] = useState('5.00')
  
  const [idType, setIdType] = useState('DNI')
  const [customIdType, setCustomIdType] = useState('')
  const [idNumber, setIdNumber] = useState('')
  
  const [licenseCountryIso, setLicenseCountryIso] = useState('PE')
  const [licenseType, setLicenseType] = useState('CMP')
  const [customLicenseType, setCustomLicenseType] = useState('')
  const [licenseNumberVal, setLicenseNumberVal] = useState('')

  const [specialistRegistryType, setSpecialistRegistryType] = useState('RNE')
  const [customSpecialistRegistryType, setCustomSpecialistRegistryType] = useState('')
  const [specialistRegistryNumberVal, setSpecialistRegistryNumberVal] = useState('')

  // --- Foto de perfil ---
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  
  // --- Estados de UI ---
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [step, setStep] = useState(1)
  const totalSteps = 3

  // Genera (y libera) la vista previa local de la foto seleccionada.
  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null)
      return
    }
    const objectUrl = URL.createObjectURL(photoFile)
    setPhotoPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photoFile])

  useEffect(() => {
    let mounted = true
    const bootstrap = async () => {
      try {
        const specialtiesResponse = await getSpecialties()
        if (!mounted) return
        setSpecialties(specialtiesResponse.specialties)

        if (isDoctorEditing) {
          const app = await getMyDoctorApplication()
          if (!mounted) return
          
          setEmail(app.email)
          
          // Parsear Nombre y Prefijo
          const prefixes = ['Dr.', 'Dra.', 'Lic.', 'Psic.', 'Odont.']
          let matchedPrefix = 'Dr.'
          let nameWithoutPrefix = app.display_name || ''
          for (const p of prefixes) {
            if (app.display_name?.startsWith(`${p} `)) {
              matchedPrefix = p
              nameWithoutPrefix = app.display_name.slice(p.length + 1)
              break
            }
          }
          setNamePrefix(matchedPrefix)
          setBaseName(nameWithoutPrefix)
          
          setProfessionalTitle(app.professional_title || '')
          setBioShort(app.bio_short || '')
          setPricePerMinute(centsToDisplay(app.price_per_min_cents))
          setDoctorTimezone(app.timezone || 'America/Lima')
          setYearsExperience(String(app.years_experience ?? 0))
          setSelectedSpecialties(app.specialties.map((s) => s.id))

          // Parsear País y Ciudad
          const matchedCountry = allCountries.find(c => c.name === app.country)
          const iso = matchedCountry ? matchedCountry.isoCode : 'PE'
          setCountryIso(iso)
          
          const loadedCities = await getCitiesOfCountry(iso)
          setAvailableCities(loadedCities)
          if (app.city && loadedCities.includes(app.city)) {
            setCityName(app.city || '')
          } else {
            setCityName('Otra')
            setCustomCity(app.city || '')
          }

          // Parsear Documento de Identidad
          const splitId = app.government_id?.split(' ') || ['DNI', '']
          const parsedIdType = splitId[0] || 'DNI'
          if (!getCountryDocs(iso).idTypes.includes(parsedIdType) && parsedIdType !== 'Otro') {
             setIdType('Otro')
             setCustomIdType(parsedIdType)
          } else {
             setIdType(parsedIdType)
          }
          setIdNumber(splitId.slice(1).join(' ') || '')

          // Parsear Licencia Médica
          const matchedLicCountry = allCountries.find(c => c.name === app.license_country)
          const licIso = matchedLicCountry ? matchedLicCountry.isoCode : 'PE'
          setLicenseCountryIso(licIso)

          const splitLic = app.license_number?.split(' ') || ['CMP', '']
          const parsedLicType = splitLic[0] || 'CMP'
          if (!getCountryDocs(licIso).licenseTypes.includes(parsedLicType) && parsedLicType !== 'Otro') {
             setLicenseType('Otro')
             setCustomLicenseType(parsedLicType)
          } else {
             setLicenseType(parsedLicType)
          }
          setLicenseNumberVal(splitLic.slice(1).join(' ') || '')

          // Parsear Registro de Especialista
          const registryTypes = getCountryDocs(licIso).specialistRegistryTypes
          const defaultRegistryType = registryTypes[0]
          const splitRegistry = app.specialist_registry_number?.split(' ') || [defaultRegistryType, '']
          const parsedRegistryType = splitRegistry[0] || defaultRegistryType
          if (!registryTypes.includes(parsedRegistryType) && parsedRegistryType !== 'Otro') {
             setSpecialistRegistryType('Otro')
             setCustomSpecialistRegistryType(parsedRegistryType)
          } else {
             setSpecialistRegistryType(parsedRegistryType)
          }
          setSpecialistRegistryNumberVal(splitRegistry.slice(1).join(' ') || '')

          setExistingPhotoUrl(app.photo_url || null)
        } else {
          setAvailableCities(await getCitiesOfCountry(countryIso))
        }
      } catch (err: unknown) {
        if (mounted) setError('Error al cargar datos del perfil.')
      } finally {
        if (mounted) setIsBootstrapping(false)
      }
    }

    if (!authLoading) bootstrap()
    return () => { mounted = false }
  }, [authLoading, isDoctorEditing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handlers para cuando cambia el país
  const handleCountryChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const iso = e.target.value
    setCountryIso(iso)
    const cities = await getCitiesOfCountry(iso)
    setAvailableCities(cities)
    setCityName(cities.length > 0 ? cities[0] : 'Otra')
    
    // Actualizar documentos según el nuevo país
    const docs = getCountryDocs(iso)
    setIdType(docs.idTypes[0])
    setLicenseCountryIso(iso)
    setLicenseType(docs.licenseTypes[0])
    setSpecialistRegistryType(docs.specialistRegistryTypes[0])
    setCustomSpecialistRegistryType('')
  }

  const handleLicenseCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const iso = e.target.value
    setLicenseCountryIso(iso)
    const docs = getCountryDocs(iso)
    setLicenseType(docs.licenseTypes[0])
    setSpecialistRegistryType(docs.specialistRegistryTypes[0])
    setCustomSpecialistRegistryType('')
  }

  const parsedPricePerMinCents = useMemo(() => {
    const parsed = Number(pricePerMinute.replace(',', '.').trim())
    return Number.isNaN(parsed) ? null : Math.round(parsed * 100)
  }, [pricePerMinute])

  const parsedYearsExperience = useMemo(() => {
    const parsed = Number(yearsExperience)
    return Number.isNaN(parsed) ? null : Math.round(parsed)
  }, [yearsExperience])

  const toggleSpecialty = (specialtyId: number) => {
    setSelectedSpecialties((current) =>
      current.includes(specialtyId) ? current.filter((id) => id !== specialtyId) : [...current, specialtyId]
    )
  }

  const handleNextStep = async () => {
    setError(null)
    setSuccess(null)
    
    // --- VALIDACIÓN PASO 1 ---
    if (step === 1) {
      if (!email || !baseName) return setError('Completa los campos obligatorios.')
      if (cityName === 'Otra' && !customCity) return setError('Por favor especifica tu ciudad.')
      
      if (!isDoctorEditing) {
        if (password.length < 8 || password !== confirmPassword) {
          return setError('Las contraseñas no coinciden o son muy cortas (mínimo 8 caracteres).')
        }
        // La existencia del email se valida al enviar: el backend responde con un
        // error claro si ya está registrado como médico. No exponemos un endpoint
        // público que revele si un correo existe (enumeración de usuarios).
      }
    }
    
    // --- VALIDACIÓN PASO 2 ---
    if (step === 2) {
      if (!professionalTitle) return setError('El título profesional es obligatorio.')
      if (selectedSpecialties.length === 0) return setError('Selecciona al menos una especialidad.')
      if (parsedYearsExperience === null || parsedYearsExperience < 0) return setError('Años de experiencia inválidos.')
      if (parsedYearsExperience > 80) return setError('Los años de experiencia no pueden superar 80.')
    }
    
    // Si todo sale bien, avanzamos al siguiente paso
    setStep((prev) => Math.min(prev + 1, totalSteps))
  }

  const handlePrevStep = () => {
    setError(null)
    setSuccess(null)
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setRemovePhoto(true)
  }

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('La foto debe ser una imagen (JPG, PNG o WEBP).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La foto no puede superar los 5 MB.')
      return
    }
    setPhotoFile(file)
    setRemovePhoto(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    
    if (selectedSpecialties.length === 0) return setError('Selecciona al menos una especialidad.')
    if (!professionalTitle) return setError('El título profesional es obligatorio.')
    if (parsedPricePerMinCents === null || parsedPricePerMinCents <= 0) return setError('Ingresa un costo válido.')
    if (!idNumber || !licenseNumberVal) return setError('Completa tus credenciales de identidad y médicas.')
    if (!specialistRegistryNumberVal) return setError('Completa tu registro nacional de especialista.')
    if (idType === 'Otro' && !customIdType) return setError('Especifica el tipo de documento.')
    if (licenseType === 'Otro' && !customLicenseType) return setError('Especifica el tipo de licencia.')
    if (specialistRegistryType === 'Otro' && !customSpecialistRegistryType) return setError('Especifica el tipo de registro de especialista.')

    setIsSubmitting(true)
    
    const finalDisplayName = `${namePrefix} ${baseName}`.trim()
    const finalCity = cityName === 'Otra' ? customCity : cityName
    const finalCountryName = Country.getCountryByCode(countryIso)?.name || ''
    const finalLicenseCountryName = Country.getCountryByCode(licenseCountryIso)?.name || ''
    
    const finalIdType = idType === 'Otro' ? customIdType : idType
    const finalLicenseType = licenseType === 'Otro' ? customLicenseType : licenseType
    const finalSpecialistRegistryType = specialistRegistryType === 'Otro' ? customSpecialistRegistryType : specialistRegistryType

    const finalGovernmentId = `${finalIdType} ${idNumber}`
    const finalLicenseNumber = `${finalLicenseType} ${licenseNumberVal}`
    const finalSpecialistRegistryNumber = `${finalSpecialistRegistryType} ${specialistRegistryNumberVal}`

    const syncPhoto = async (): Promise<string | null> => {
      if (photoFile) {
        const result = await uploadMyDoctorPhoto(photoFile)
        setExistingPhotoUrl(result.photo_url)
        return result.photo_url
      } else if (removePhoto && existingPhotoUrl) {
        await deleteMyDoctorPhoto()
        setExistingPhotoUrl(null)
        return null
      }
      return existingPhotoUrl
    }

    try {
      const payload = {
        display_name: finalDisplayName,
        professional_title: professionalTitle,
        bio_short: bioShort,
        price_per_min_cents: parsedPricePerMinCents,
        license_number: finalLicenseNumber,
        license_country: finalLicenseCountryName,
        specialist_registry_number: finalSpecialistRegistryNumber,
        country: finalCountryName,
        city: finalCity,
        timezone: doctorTimezone,
        government_id: finalGovernmentId,
        years_experience: parsedYearsExperience as number,
        specialty_ids: selectedSpecialties,
      }

      if (isDoctorEditing) {
        await updateMyDoctorProfile(payload)
        // La foto se sube después de guardar el perfil (el endpoint requiere el perfil creado).
        try {
          await syncPhoto()
        } catch (photoError: unknown) {
          setPhotoFile(null)
          await refreshUser()
          setError(getApiErrorMessage(photoError, 'Perfil guardado, pero no se pudo actualizar la foto.'))
          return
        }
        setPhotoFile(null)
        setRemovePhoto(false)
        // Nos quedamos en la pagina para mostrar la confirmacion y permitir
        // seguir editando; antes se enviaba al dashboard y parecia un error.
        await refreshUser()
        setSuccess('Perfil actualizado correctamente. Puedes seguir editando o volver al panel.')
      } else {
        const response = await registerDoctor({ ...payload, email, password })
        authLogin(response.access_token, response.user)
        // La foto es opcional: si falla, la cuenta ya quedó creada y el médico
        // puede subirla luego desde su perfil.
        try {
          await syncPhoto()
        } catch (photoError) {
          console.warn('No se pudo subir la foto del médico durante el registro.', photoError)
        }
        navigate('/doctor/pending')
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Error al enviar la postulación médica.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isProfileRoute = location.pathname.startsWith('/doctor/profile')

  const statusBanner =
    user?.doctor_status === 'approved'
      ? {
          className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
          text: 'Perfil verificado: los pacientes ya pueden encontrarte y agendar citas.',
        }
      : user?.doctor_status === 'pending'
        ? {
            className: 'border-amber-200 bg-amber-50 text-amber-800',
            text: 'Tu perfil está en revisión. Puedes seguir editándolo mientras tanto.',
          }
        : {
            className: 'border-red-200 bg-red-50 text-red-700',
            text: 'Tu perfil requiere cambios. Actualiza tus datos y vuelve a guardar.',
          }

  if (!authLoading && isAuthenticated && user?.role === 'patient' && !user.doctor_status) return <Navigate to="/" replace />
  // Un medico aprobado no debe volver al formulario de postulacion, pero si
  // puede seguir usando /doctor/profile para actualizar sus datos.
  if (!authLoading && isAuthenticated && user?.doctor_status === 'approved' && !isProfileRoute) {
    return <Navigate to="/doctor/profile" replace />
  }

  return (
    <div className="mx-auto max-w-4xl">
      <BackButton useHistoryBack />

      <div className="card shadow-sm border border-slate-100 rounded-2xl bg-white p-6 sm:p-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-4 border-b border-slate-100 pb-6">
          <div className="rounded-2xl bg-primary-100 p-3 w-fit">
            <ClipboardList className="h-8 w-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {isProfileRoute ? 'Mi perfil profesional' : isDoctorEditing ? 'Actualizar perfil' : 'Postulación médica'}
            </h1>
            <p className="mt-1 text-slate-500 text-sm">
              {isProfileRoute
                ? 'Datos profesionales visibles para los pacientes. Tu perfil de paciente (datos personales y clínicos) se edita por separado en el portal del paciente.'
                : 'Completa tu perfil profesional para habilitar el panel médico y videoconsultas.'}
            </p>
          </div>
        </div>

        {isProfileRoute && (
          <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${statusBanner.className}`}>
            {statusBanner.text}
          </div>
        )}

        {isBootstrapping ? (
          <div className="flex min-h-[200px] items-center justify-center text-slate-500">
            <Loader2 className="mr-3 h-6 w-6 animate-spin" /> Cargando formulario...
          </div>
        ) : (
          <>
            {/* Indicador de Pasos (Stepper) */}
            {!isProfileRoute && (
            <div className="mb-8 flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -z-10 h-0.5 w-full bg-slate-100 -translate-y-1/2"></div>
              {[
                { id: 1, label: 'Cuenta' },
                { id: 2, label: 'Perfil' },
                { id: 3, label: 'Credenciales' }
              ].map((s) => (
                <div key={s.id} className="flex flex-col items-center gap-2 bg-white px-2">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                    step > s.id 
                      ? 'border-primary-600 bg-primary-600 text-white' 
                      : step === s.id 
                        ? 'border-primary-600 bg-white text-primary-600' 
                        : 'border-slate-200 bg-white text-slate-500'
                  }`}>
                    {step > s.id ? <Check className="w-5 h-5" /> : s.id}
                  </div>
                  <span className={`text-xs font-medium ${step >= s.id ? 'text-slate-900' : 'text-slate-500'}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            )}

            <form onSubmit={isProfileRoute || step === totalSteps ? handleSubmit : (e) => e.preventDefault()} className="space-y-6">
              
              {/* PASO 1: CUENTA Y UBICACIÓN */}
              {(isProfileRoute || step === 1) && (
                <div className="animate-fade-in">
                  <h2 className="text-xl font-semibold mb-4 text-slate-800">Datos personales y ubicación</h2>
                  <div className="grid gap-6 md:grid-cols-2">
                    <Input
                      label="Correo profesional"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isDoctorEditing}
                      required
                      placeholder="medico@clinica.pe"
                      autoComplete="email"
                    />

                    <Field label="Nombres y apellidos" required htmlFor="doctor-name">
                      <div className="flex gap-2">
                        <select
                          aria-label="Tratamiento"
                          value={namePrefix}
                          onChange={(e) => setNamePrefix(e.target.value)}
                          className="input-field flex-none bg-white px-2"
                          style={{ width: '100px' }}
                        >
                          <option value="Dr.">Dr.</option>
                          <option value="Dra.">Dra.</option>
                          <option value="Lic.">Lic.</option>
                          <option value="Psic.">Psic.</option>
                          <option value="Odont.">Odont.</option>
                        </select>
                        <input
                          id="doctor-name"
                          type="text"
                          value={baseName}
                          onChange={(e) => setBaseName(e.target.value)}
                          className="input-field min-w-0 flex-1"
                          required
                          placeholder="Juan Pérez"
                        />
                      </div>
                    </Field>

                    {!isDoctorEditing && (
                      <>
                        <PasswordInput
                          label="Contraseña"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={8}
                          placeholder="••••••••"
                          autoComplete="new-password"
                        />
                        <PasswordInput
                          label="Confirmar contraseña"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={8}
                          placeholder="••••••••"
                          autoComplete="new-password"
                        />
                      </>
                    )}

                    <Select label="País de residencia" value={countryIso} onChange={handleCountryChange} required>
                      {allCountries.map((c) => (
                        <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
                      ))}
                    </Select>

                    {availableCities.length > 0 ? (
                      <Select label="Ciudad" value={cityName} onChange={(e) => setCityName(e.target.value)} required>
                        {availableCities.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        <option value="Otra">Otra…</option>
                      </Select>
                    ) : (
                      <Input
                        label="Ciudad"
                        value={customCity}
                        onChange={(e) => setCustomCity(e.target.value)}
                        required
                        placeholder="Escribe tu ciudad"
                      />
                    )}

                    {availableCities.length > 0 && cityName === 'Otra' && (
                      <Input
                        label="Especifica tu ciudad"
                        value={customCity}
                        onChange={(e) => setCustomCity(e.target.value)}
                        required
                        placeholder="Escribe tu ciudad"
                      />
                    )}

                    <div className="md:col-span-2">
                      <Select
                        label="Zona horaria (crítico para videollamadas)"
                        value={doctorTimezone}
                        onChange={(e) => setDoctorTimezone(e.target.value)}
                        required
                      >
                        {timezones.map((tz: string) => (
                          <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* PASO 2: PERFIL PROFESIONAL */}
              {(isProfileRoute || step === 2) && (
                <div className="animate-fade-in">
                  <h2 className="text-xl font-semibold mb-4 text-slate-800">Especialidad y experiencia</h2>

                  <div className="mb-6 flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row">
                    <div className="h-28 w-28 flex-none overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      {photoPreview || (!removePhoto && existingPhotoUrl) ? (
                        <img
                          src={photoPreview || existingPhotoUrl || ''}
                          alt="Foto de perfil del médico"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <Camera className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-2 sm:items-start">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary-400 hover:text-primary-700">
                          <Camera className="h-4 w-4" />
                          {photoFile || (existingPhotoUrl && !removePhoto) ? 'Cambiar foto' : 'Subir foto'}
                          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                        </label>
                        {(photoFile || (existingPhotoUrl && !removePhoto)) && (
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">JPG, PNG o WEBP. Máximo 5 MB.</p>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2 mb-6">
                    <Input
                      label="Título profesional"
                      value={professionalTitle}
                      onChange={(e) => setProfessionalTitle(e.target.value)}
                      required
                      placeholder="Ej: Médico Cirujano"
                    />
                    <Input
                      label="Años de experiencia"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={80}
                      value={yearsExperience}
                      onChange={(e) => setYearsExperience(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-6">
                    <Textarea
                      label="Resumen profesional"
                      value={bioShort}
                      onChange={(e) => setBioShort(e.target.value)}
                      className="min-h-[100px] resize-y"
                      maxLength={500}
                      placeholder="Resume tu enfoque clínico y experiencia para los pacientes..."
                    />
                    <div className="mt-1.5 flex justify-end">
                      <span className={`text-xs transition-colors ${bioShort.length >= 480 ? 'font-medium text-red-500' : 'text-slate-500'}`}>
                        {bioShort.length} / 500 caracteres
                      </span>
                    </div>
                  </div>

                  <fieldset>
                    <legend className="mb-3 block font-medium text-slate-700">Selecciona tus especialidades *</legend>
                    <div className="grid max-h-60 gap-3 overflow-y-auto p-1 md:grid-cols-2">
                      {specialties.map((specialty) => {
                        const selected = selectedSpecialties.includes(specialty.id)
                        return (
                          <label key={specialty.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${selected ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-slate-200 bg-white hover:border-primary-200'}`}>
                            <input type="checkbox" checked={selected} onChange={() => toggleSpecialty(specialty.id)} className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                            <div><p className="text-sm font-medium text-slate-900">{specialty.name}</p></div>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>
                </div>
              )}

              {/* PASO 3: CREDENCIALES */}
              {(isProfileRoute || step === 3) && (
                <div className="animate-fade-in">
                  <h2 className="text-xl font-semibold mb-4 text-slate-800">Verificación y honorarios</h2>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <Field label="Costo por minuto (USD)" required htmlFor="doctor-price">
                        <div className="relative flex items-center">
                          <span className="pointer-events-none absolute left-3 text-slate-500">$</span>
                          <input
                            id="doctor-price"
                            type="number"
                            step="0.01"
                            min="0.1"
                            inputMode="decimal"
                            value={pricePerMinute}
                            onChange={(e) => setPricePerMinute(e.target.value)}
                            className="input-field"
                            style={{ paddingLeft: '1.75rem' }}
                            required
                          />
                        </div>
                      </Field>
                      <p className="mt-1 text-xs text-slate-500">
                        Ej: 15 min = ${(Number(pricePerMinute) * 15 || 0).toFixed(2)} USD
                      </p>
                    </div>

                    <Field label="Documento de identidad" required htmlFor="doctor-id-number">
                      <div className="flex flex-col gap-2 xl:flex-row">
                        <select
                          aria-label="Tipo de documento"
                          value={idType}
                          onChange={(e) => setIdType(e.target.value)}
                          className="input-field flex-none bg-white"
                          style={{ width: '110px' }}
                        >
                          {getCountryDocs(countryIso).idTypes.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>

                        {idType === 'Otro' && (
                          <input
                            type="text"
                            aria-label="Tipo de documento personalizado"
                            value={customIdType}
                            onChange={(e) => setCustomIdType(e.target.value)}
                            className="input-field flex-none bg-primary-50 transition-colors focus:bg-white"
                            style={{ width: '100px' }}
                            placeholder="Ej: RUT"
                            required
                            autoFocus
                          />
                        )}
                        <input
                          id="doctor-id-number"
                          type="text"
                          value={idNumber}
                          onChange={(e) => setIdNumber(e.target.value)}
                          className="input-field min-w-0 flex-1"
                          required
                          placeholder="Número"
                        />
                      </div>
                    </Field>

                    <Select
                      label="País de expedición (licencia)"
                      value={licenseCountryIso}
                      onChange={handleLicenseCountryChange}
                    >
                      {allCountries.map((c) => (
                        <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
                      ))}
                    </Select>

                    <Field label="Registro médico" required htmlFor="doctor-license-number">
                      <div className="flex flex-col gap-2 xl:flex-row">
                        <select
                          aria-label="Tipo de registro médico"
                          value={licenseType}
                          onChange={(e) => setLicenseType(e.target.value)}
                          className="input-field flex-none bg-white"
                          style={{ width: '110px' }}
                        >
                          {getCountryDocs(licenseCountryIso).licenseTypes.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>

                        {licenseType === 'Otro' && (
                          <input
                            type="text"
                            aria-label="Entidad de registro personalizada"
                            value={customLicenseType}
                            onChange={(e) => setCustomLicenseType(e.target.value)}
                            className="input-field flex-none bg-primary-50 transition-colors focus:bg-white"
                            style={{ width: '110px' }}
                            placeholder="Entidad"
                            required
                            autoFocus
                          />
                        )}
                        <input
                          id="doctor-license-number"
                          type="text"
                          value={licenseNumberVal}
                          onChange={(e) => setLicenseNumberVal(e.target.value)}
                          className="input-field min-w-0 flex-1"
                          required
                          placeholder="Número"
                        />
                      </div>
                    </Field>

                    <Field label={getCountryDocs(licenseCountryIso).specialistRegistryLabel} required htmlFor="doctor-registry-number">
                      <div className="flex flex-col gap-2 xl:flex-row">
                        <select
                          aria-label="Tipo de registro de especialista"
                          value={specialistRegistryType}
                          onChange={(e) => setSpecialistRegistryType(e.target.value)}
                          className="input-field flex-none bg-white"
                          style={{ width: '110px' }}
                        >
                          {getCountryDocs(licenseCountryIso).specialistRegistryTypes.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>

                        {specialistRegistryType === 'Otro' && (
                          <input
                            type="text"
                            aria-label="Tipo de registro de especialista personalizado"
                            value={customSpecialistRegistryType}
                            onChange={(e) => setCustomSpecialistRegistryType(e.target.value)}
                            className="input-field flex-none bg-primary-50 transition-colors focus:bg-white"
                            style={{ width: '110px' }}
                            placeholder="Entidad"
                            required
                            autoFocus
                          />
                        )}
                        <input
                          id="doctor-registry-number"
                          type="text"
                          value={specialistRegistryNumberVal}
                          onChange={(e) => setSpecialistRegistryNumberVal(e.target.value)}
                          className="input-field min-w-0 flex-1"
                          required
                          placeholder="Número"
                        />
                      </div>
                    </Field>
                  </div>

                  {!isDoctorEditing && (
                    <Alert tone="info" className="mt-6">
                      Al enviar tus datos, nuestro equipo verificará tu identidad y registro médico antes de habilitar
                      tu perfil para teleconsultas.
                    </Alert>
                  )}
                </div>
              )}

              {/* Mensajes de feedback */}
              {error && <Alert tone="danger">{error}</Alert>}
              {success && <Alert tone="success">{success}</Alert>}

              {/* Controles de Navegación del Wizard */}
              <div className={`mt-8 flex items-center border-t border-slate-100 pt-6 ${isProfileRoute ? 'justify-end' : 'justify-between'}`}>
                <Button
                  variant="ghost"
                  onClick={handlePrevStep}
                  disabled={step === 1 || isSubmitting}
                  leftIcon={<ChevronLeft className="h-4 w-4" />}
                  className={isProfileRoute ? 'hidden' : ''}
                >
                  Atrás
                </Button>

                {isProfileRoute ? (
                  <Button type="submit" loading={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500">
                    Guardar cambios
                  </Button>
                ) : step < totalSteps ? (
                  <Button
                    key="wizard-next"
                    type="button"
                    onClick={(event) => {
                      // Evita que el navegador aplique la acción por defecto del click
                      // si React reutiliza este nodo y lo convierte en type="submit".
                      event.preventDefault()
                      void handleNextStep()
                    }}
                    rightIcon={<ChevronRight className="h-4 w-4" />}
                  >
                    Siguiente
                  </Button>
                ) : (
                  <Button
                    key="wizard-submit"
                    type="submit"
                    loading={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500"
                  >
                    {isDoctorEditing ? 'Actualizar perfil' : 'Enviar postulación'}
                  </Button>
                )}
              </div>
            </form>
          </>
        )}

        {!isDoctorEditing && !isBootstrapping && (
          <p className="mt-8 text-center text-sm text-slate-500">
            ¿Ya tienes cuenta médica? <Link to="/login" replace className="font-medium text-primary-600 hover:underline">Inicia sesión</Link>
          </p>
        )}
      </div>
    </div>
  )
}