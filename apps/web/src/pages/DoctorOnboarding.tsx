import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ClipboardList, Loader2, ChevronRight, ChevronLeft, Check, ShieldCheck } from 'lucide-react'
import { Country, City } from 'country-state-city'

import BackButton from '../components/BackButton'
import { registerDoctor } from '../api/auth'
import { getSpecialties, Specialty } from '../api/specialties'
import { getMyDoctorApplication, updateMyDoctorProfile } from '../api/doctors'
import { useAuth } from '../context/AuthContext'
import { checkEmailExists } from '../api/auth'

const centsToDisplay = (value: number) => (value / 100).toFixed(2)

// Zonas horarias nativas
const timezones: string[] = (Intl as any).supportedValuesOf 
  ? (Intl as any).supportedValuesOf('timeZone') 
  : ['America/Lima', 'America/Bogota', 'America/Mexico_City', 'Europe/Madrid']

// Diccionario de documentos por ISO de país
const DOC_DATA: Record<string, { idTypes: string[], licenseTypes: string[] }> = {
  'PE': { idTypes: ['DNI', 'CE', 'Pasaporte', 'Otro'], licenseTypes: ['CMP', 'COP', 'CEP', 'CBP', 'Otro'] },
  'CO': { idTypes: ['CC', 'CE', 'Pasaporte', 'Otro'], licenseTypes: ['ReTHUS', 'Otro'] },
  'MX': { idTypes: ['INE', 'Pasaporte', 'Otro'], licenseTypes: ['Cédula Prof.', 'Otro'] },
  'CL': { idTypes: ['RUT', 'Pasaporte', 'Otro'], licenseTypes: ['Superintendencia', 'Otro'] },
  'DEFAULT': { idTypes: ['ID', 'Pasaporte', 'Otro'], licenseTypes: ['Licencia Médica', 'Otro'] }
}

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

  const [isValidating, setIsValidating] = useState(false)

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
  
  // --- Estados de UI ---
  const availableCities = City.getCitiesOfCountry(countryIso) || []
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [step, setStep] = useState(1)
  const totalSteps = 3

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
          
          const loadedCities = City.getCitiesOfCountry(iso) || []
          if (loadedCities.some(c => c.name === app.city)) {
            setCityName(app.city || '')
          } else {
            setCityName('Otra')
            setCustomCity(app.city || '')
          }

          // Parsear Documento de Identidad
          const splitId = app.government_id?.split(' ') || ['DNI', '']
          const parsedIdType = splitId[0] || 'DNI'
          if (!DOC_DATA[iso]?.idTypes.includes(parsedIdType) && parsedIdType !== 'Otro') {
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
          if (!DOC_DATA[licIso]?.licenseTypes.includes(parsedLicType) && parsedLicType !== 'Otro') {
             setLicenseType('Otro')
             setCustomLicenseType(parsedLicType)
          } else {
             setLicenseType(parsedLicType)
          }
          setLicenseNumberVal(splitLic.slice(1).join(' ') || '')
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
  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const iso = e.target.value
    setCountryIso(iso)
    const cities = City.getCitiesOfCountry(iso)
    setCityName(cities && cities.length > 0 ? cities[0].name : 'Otra')
    
    // Actualizar documentos según el nuevo país
    const docs = DOC_DATA[iso] || DOC_DATA['DEFAULT']
    setIdType(docs.idTypes[0])
    setLicenseCountryIso(iso)
    setLicenseType(docs.licenseTypes[0])
  }

  const handleLicenseCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const iso = e.target.value
    setLicenseCountryIso(iso)
    const docs = DOC_DATA[iso] || DOC_DATA['DEFAULT']
    setLicenseType(docs.licenseTypes[0])
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
        if (password.length < 6 || password !== confirmPassword) {
          return setError('Las contraseñas no coinciden o son muy cortas (mínimo 6 caracteres).')
        }

        // NUEVO: Verificamos en la BD si el email ya existe y su rol
        setIsValidating(true)
        try {
          const { exists, role } = await checkEmailExists(email)
          
          // Solo bloqueamos si existe Y además ya es doctor
          if (exists && role === 'doctor') {
            setError('Este email ya está registrado como médico. Por favor, inicia sesión.')
            setIsValidating(false)
            return // Bloqueamos el avance
          }

          // Si el usuario existe (paciente, revisor o admin) o no existe, el código
          // sigue de largo. Al enviarse, el backend conserva el rol si es revisor o
          // admin y añade la capacidad médica mediante su DoctorProfile.

          // Si el usuario existe y es 'patient' o no existe, simplemente 
          // el código sigue de largo y pasa al Paso 2 sin problemas.

        } catch (err) {
          setError('Hubo un problema verificando tu correo. Intenta de nuevo.')
          setIsValidating(false)
          return
        }
        setIsValidating(false)
      }
    }
    
    // --- VALIDACIÓN PASO 2 ---
    if (step === 2) {
      if (!professionalTitle) return setError('El título profesional es obligatorio.')
      if (selectedSpecialties.length === 0) return setError('Selecciona al menos una especialidad.')
      if (parsedYearsExperience === null || parsedYearsExperience < 0) return setError('Años de experiencia inválidos.')
    }
    
    // Si todo sale bien, avanzamos al siguiente paso
    setStep((prev) => Math.min(prev + 1, totalSteps))
  }

  const handlePrevStep = () => {
    setError(null)
    setSuccess(null)
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    
    if (parsedPricePerMinCents === null || parsedPricePerMinCents <= 0) return setError('Ingresa un costo válido.')
    if (!idNumber || !licenseNumberVal) return setError('Completa tus credenciales de identidad y médicas.')
    if (idType === 'Otro' && !customIdType) return setError('Especifica el tipo de documento.')
    if (licenseType === 'Otro' && !customLicenseType) return setError('Especifica el tipo de licencia.')

    setIsSubmitting(true)
    
    const finalDisplayName = `${namePrefix} ${baseName}`.trim()
    const finalCity = cityName === 'Otra' ? customCity : cityName
    const finalCountryName = Country.getCountryByCode(countryIso)?.name || ''
    const finalLicenseCountryName = Country.getCountryByCode(licenseCountryIso)?.name || ''
    
    const finalIdType = idType === 'Otro' ? customIdType : idType
    const finalLicenseType = licenseType === 'Otro' ? customLicenseType : licenseType

    const finalGovernmentId = `${finalIdType} ${idNumber}`
    const finalLicenseNumber = `${finalLicenseType} ${licenseNumberVal}`

    try {
      const payload = {
        display_name: finalDisplayName,
        professional_title: professionalTitle,
        bio_short: bioShort,
        price_per_min_cents: parsedPricePerMinCents,
        license_number: finalLicenseNumber,
        license_country: finalLicenseCountryName,
        country: finalCountryName,
        city: finalCity,
        timezone: doctorTimezone,
        government_id: finalGovernmentId,
        years_experience: parsedYearsExperience as number,
        specialty_ids: selectedSpecialties,
      }

      if (isDoctorEditing) {
        await updateMyDoctorProfile(payload)
        // Nos quedamos en la pagina para mostrar la confirmacion y permitir
        // seguir editando; antes se enviaba al dashboard y parecia un error.
        await refreshUser()
        setSuccess('Perfil actualizado correctamente. Puedes seguir editando o volver al panel.')
      } else {
        const response = await registerDoctor({ ...payload, email, password })
        authLogin(response.access_token, response.user)
        navigate('/doctor/pending')
      }
    } catch (err: unknown) {
      const reqErr = err as { response?: { data?: { detail?: string } } }
      setError(reqErr.response?.data?.detail || 'Error al enviar la postulación médica.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isProfileRoute = location.pathname.startsWith('/doctor/profile')

  if (!authLoading && isAuthenticated && user?.role === 'patient' && !user.doctor_status) return <Navigate to="/" replace />
  // Un medico aprobado no debe volver al formulario de postulacion, pero si
  // puede seguir usando /doctor/profile para actualizar sus datos.
  if (!authLoading && isAuthenticated && user?.doctor_status === 'approved' && !isProfileRoute) {
    return <Navigate to="/doctor/profile" replace />
  }

  return (
    <div className="mx-auto max-w-4xl">
      <BackButton useHistoryBack />

      <div className="card shadow-sm border border-gray-100 rounded-2xl bg-white p-6 sm:p-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-4 border-b border-gray-100 pb-6">
          <div className="rounded-2xl bg-primary-100 p-3 w-fit">
            <ClipboardList className="h-8 w-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {isDoctorEditing ? 'Actualizar perfil' : 'Postulación médica'}
            </h1>
            <p className="mt-1 text-gray-500 text-sm">
              Completa tu perfil profesional para habilitar el panel médico y videoconsultas.
            </p>
          </div>
        </div>

        {isBootstrapping ? (
          <div className="flex min-h-[200px] items-center justify-center text-gray-500">
            <Loader2 className="mr-3 h-6 w-6 animate-spin" /> Cargando formulario...
          </div>
        ) : (
          <>
            {/* Indicador de Pasos (Stepper) */}
            <div className="mb-8 flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -z-10 h-0.5 w-full bg-gray-100 -translate-y-1/2"></div>
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
                        : 'border-gray-200 bg-white text-gray-400'
                  }`}>
                    {step > s.id ? <Check className="w-5 h-5" /> : s.id}
                  </div>
                  <span className={`text-xs font-medium ${step >= s.id ? 'text-gray-900' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            <form onSubmit={step === totalSteps ? handleSubmit : (e) => e.preventDefault()} className="space-y-6">
              
              {/* PASO 1: CUENTA Y UBICACIÓN */}
              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <h2 className="text-xl font-semibold mb-4 text-gray-800">Datos Personales y Ubicación</h2>
                  <div className="grid gap-6 md:grid-cols-2">
                    
                    <div>
                      <label className="mb-1.5 block font-medium text-gray-700">Email profesional *</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isDoctorEditing} className={`input-field ${isDoctorEditing ? 'bg-gray-50 cursor-not-allowed' : ''}`} required placeholder="medico@clinica.pe" />
                    </div>
                    
                    <div>
                      <label className="mb-1.5 block font-medium text-gray-700">Nombres y Apellidos *</label>
                      <div className="flex gap-2">
                        <select value={namePrefix} onChange={(e) => setNamePrefix(e.target.value)} className="input-field bg-white flex-none px-2" style={{ width: '100px' }}>
                          <option value="Dr.">Dr.</option>
                          <option value="Dra.">Dra.</option>
                          <option value="Lic.">Lic.</option>
                          <option value="Psic.">Psic.</option>
                          <option value="Odont.">Odont.</option>
                        </select>
                        <input type="text" value={baseName} onChange={(e) => setBaseName(e.target.value)} className="input-field flex-1 min-w-0" required placeholder="Juan Pérez" />
                      </div>
                    </div>
                    
                    {!isDoctorEditing && (
                      <>
                        <div>
                          <label className="mb-1.5 block font-medium text-gray-700">Contraseña *</label>
                          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" required minLength={6} placeholder="••••••••" />
                        </div>
                        <div>
                          <label className="mb-1.5 block font-medium text-gray-700">Confirmar contraseña *</label>
                          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field" required minLength={6} placeholder="••••••••" />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="mb-1.5 block font-medium text-gray-700">País de residencia *</label>
                      <select value={countryIso} onChange={handleCountryChange} className="input-field bg-white">
                        {allCountries.map((c) => (
                          <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block font-medium text-gray-700">Ciudad *</label>
                      {cityName === 'Otra' || availableCities.length === 0 ? (
                        <div className="flex gap-2 animate-in fade-in">
                          {availableCities.length > 0 && (
                            <select value={cityName} onChange={(e) => setCityName(e.target.value)} className="input-field bg-white flex-none" style={{ width: '100px' }}>
                              <option value="Otra">Otra</option>
                            </select>
                          )}
                          <input type="text" value={customCity} onChange={(e) => setCustomCity(e.target.value)} className="input-field flex-1 min-w-0" required placeholder="Escribe tu ciudad" autoFocus />
                        </div>
                      ) : (
                        <select value={cityName} onChange={(e) => setCityName(e.target.value)} className="input-field bg-white">
                          {availableCities.map((c) => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                          <option value="Otra">Otra...</option>
                        </select>
                      )}
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block font-medium text-gray-700">Zona Horaria (Crítico para videollamadas) *</label>
                      <select value={doctorTimezone} onChange={(e) => setDoctorTimezone(e.target.value)} className="input-field bg-white" required>
                        {timezones.map((tz: string) => (
                          <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* PASO 2: PERFIL PROFESIONAL */}
              {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <h2 className="text-xl font-semibold mb-4 text-gray-800">Especialidad y Experiencia</h2>
                  <div className="grid gap-6 md:grid-cols-2 mb-6">
                    <div>
                      <label className="mb-1.5 block font-medium text-gray-700">Título profesional *</label>
                      <input type="text" value={professionalTitle} onChange={(e) => setProfessionalTitle(e.target.value)} className="input-field" required placeholder="Ej: Médico Cirujano" />
                    </div>
                    <div>
                      <label className="mb-1.5 block font-medium text-gray-700">Años de experiencia *</label>
                      <input type="number" min="0" max="80" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} className="input-field" required />
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="mb-1.5 block font-medium text-gray-700">Resumen Profesional</label>
                    <textarea 
                      value={bioShort} 
                      onChange={(e) => setBioShort(e.target.value)} 
                      className="input-field min-h-[100px] resize-y" 
                      maxLength={500} 
                      placeholder="Resume tu enfoque clínico y experiencia para los pacientes..." 
                    />
                    <div className="mt-1.5 flex justify-end">
                      <span className={`text-xs transition-colors ${bioShort.length >= 480 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                        {bioShort.length} / 500 caracteres
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block font-medium text-gray-700">Selecciona tus Especialidades *</label>
                    <div className="grid gap-3 md:grid-cols-2 max-h-60 overflow-y-auto p-1">
                      {specialties.map((specialty) => {
                        const selected = selectedSpecialties.includes(specialty.id)
                        return (
                          <label key={specialty.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${selected ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-gray-200 bg-white hover:border-primary-200'}`}>
                            <input type="checkbox" checked={selected} onChange={() => toggleSpecialty(specialty.id)} className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                            <div><p className="font-medium text-sm text-gray-900">{specialty.name}</p></div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* PASO 3: CREDENCIALES */}
              {step === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <h2 className="text-xl font-semibold mb-4 text-gray-800">Verificación y Honorarios</h2>
                  <div className="grid gap-6 md:grid-cols-2">
                    
                    <div>
                      <label className="mb-1.5 block font-medium text-gray-700">Costo por minuto (USD) *</label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-gray-500 pointer-events-none">$</span>
                        <input type="number" step="0.01" min="1" value={pricePerMinute} onChange={(e) => setPricePerMinute(e.target.value)} className="input-field" style={{ paddingLeft: '1.75rem' }} required />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Ej: 15 min = ${(Number(pricePerMinute) * 15 || 0).toFixed(2)} USD</p>
                    </div>
                    
                    <div>
                      <label className="mb-1.5 block font-medium text-gray-700">Documento de Identidad *</label>
                      <div className="flex flex-col xl:flex-row gap-2">
                        <select 
                          value={idType} 
                          onChange={(e) => setIdType(e.target.value)} 
                          className="input-field bg-white flex-none" 
                          style={{ width: '110px' }}
                        >
                          {(DOC_DATA[countryIso] || DOC_DATA['DEFAULT']).idTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        
                        {idType === 'Otro' && (
                          <input 
                            type="text" 
                            value={customIdType} 
                            onChange={(e) => setCustomIdType(e.target.value)} 
                            className="input-field flex-none bg-blue-50 focus:bg-white transition-colors" 
                            style={{ width: '100px' }} 
                            placeholder="Ej: RUT" 
                            required 
                            autoFocus
                          />
                        )}
                        <input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="input-field flex-1 min-w-0" required placeholder="Número" />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block font-medium text-gray-700">País de Expedición (Licencia) *</label>
                      <select value={licenseCountryIso} onChange={handleLicenseCountryChange} className="input-field bg-white">
                         {allCountries.map((c) => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block font-medium text-gray-700">Registro Médico *</label>
                      <div className="flex flex-col xl:flex-row gap-2">
                        <select 
                          value={licenseType} 
                          onChange={(e) => setLicenseType(e.target.value)} 
                          className="input-field bg-white flex-none" 
                          style={{ width: '110px' }}
                        >
                          {(DOC_DATA[licenseCountryIso] || DOC_DATA['DEFAULT']).licenseTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>

                        {licenseType === 'Otro' && (
                          <input 
                            type="text" 
                            value={customLicenseType} 
                            onChange={(e) => setCustomLicenseType(e.target.value)} 
                            className="input-field flex-none bg-blue-50 focus:bg-white transition-colors" 
                            style={{ width: '110px' }} 
                            placeholder="Entidad" 
                            required 
                            autoFocus
                          />
                        )}
                        <input type="text" value={licenseNumberVal} onChange={(e) => setLicenseNumberVal(e.target.value)} className="input-field flex-1 min-w-0" required placeholder="Número" />
                      </div>
                    </div>
                  </div>

                  {!isDoctorEditing && (
                    <div className="mt-6 p-4 bg-blue-50 text-blue-800 rounded-xl text-sm flex gap-3 items-start">
                      <ShieldCheck className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
                      <p>Al enviar tus datos, nuestro equipo verificará tu identidad y registro médico antes de habilitar tu perfil para teleconsultas.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Mensajes de feedback */}
              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm animate-in fade-in">{error}</div>}
              {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm animate-in fade-in">{success}</div>}

              {/* Controles de Navegación del Wizard */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-100 mt-8">
                <button 
                  type="button" 
                  onClick={handlePrevStep}
                  disabled={step === 1 || isSubmitting}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${step === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <ChevronLeft className="w-4 h-4" /> Atrás
                </button>

                {step < totalSteps ? (
                  <button 
                    key="wizard-next"
                    type="button" 
                    onClick={(event) => {
                      // Evita que el navegador aplique la accion por defecto del click
                      // si React reutiliza este nodo y lo convierte en type="submit"
                      // al cambiar de paso (dispararia el guardado sin querer).
                      event.preventDefault()
                      void handleNextStep()
                    }}
                    disabled={isValidating}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    {isValidating ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Verificando...</>
                    ) : (
                      <>Siguiente <ChevronRight className="w-4 h-4" /></>
                    )}
                  </button>
                ) : (
                  <button 
                    key="wizard-submit"
                    type="submit" 
                    disabled={isSubmitting}
                    className="btn-primary inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
                    ) : (
                      isDoctorEditing ? 'Actualizar Perfil' : 'Enviar Postulación'
                    )}
                  </button>
                )}
              </div>
            </form>
          </>
        )}

        {!isDoctorEditing && !isBootstrapping && (
          <p className="mt-8 text-center text-sm text-gray-500">
            ¿Ya tienes cuenta médica? <Link to="/login" replace className="font-medium text-primary-600 hover:underline">Inicia sesión</Link>
          </p>
        )}
      </div>
    </div>
  )
}