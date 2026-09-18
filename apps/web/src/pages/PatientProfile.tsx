import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save, UserRound } from 'lucide-react'
import { Country, City } from 'country-state-city'

import {
  getMyPatientProfile,
  updateMyPatientProfile,
  type PatientProfile,
  type PatientProfilePayload,
  type PatientSex,
} from '../api/patients'
import BackButton from '../components/BackButton'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { getApiErrorMessage } from '../utils/apiError'

const SEX_OPTIONS: Array<{ value: PatientSex; label: string }> = [
  { value: 'female', label: 'Femenino' },
  { value: 'male', label: 'Masculino' },
  { value: 'other', label: 'Otro' },
]

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const FALLBACK_TIMEZONES = ['UTC', 'America/Lima', 'America/Bogota', 'America/Mexico_City', 'Europe/Madrid']

/** Lista nativa de zonas horarias (igual que en el perfil médico). */
const NATIVE_TIMEZONES: string[] = (Intl as any).supportedValuesOf
  ? (Intl as any).supportedValuesOf('timeZone')
  : FALLBACK_TIMEZONES

type CountryList = ReturnType<typeof Country.getAllCountries>

/** Normaliza nombres para comparar (quita acentos y mayúsculas): "Perú" == "Peru". */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Separa un teléfono guardado ("+51 999888777") en país (ISO) y número.
 * Elige el prefijo más largo que coincida para evitar ambigüedades (+1, +51...).
 */
function parsePhone(value: string | null, countries: CountryList): { iso: string; number: string } {
  if (!value) return { iso: '', number: '' }
  const trimmed = value.trim()

  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1)
    let best: CountryList[number] | null = null
    for (const country of countries) {
      if (digits.startsWith(country.phonecode)) {
        if (!best || country.phonecode.length > best.phonecode.length) {
          best = country
        }
      }
    }
    if (best) {
      return { iso: best.isoCode, number: digits.slice(best.phonecode.length).trim() }
    }
  }

  return { iso: '', number: trimmed }
}

export default function PatientProfilePage() {
  const { refreshUser } = useAuth()
  const toast = useToast()
  const allCountries = useMemo(() => Country.getAllCountries(), [])
  const timezones = useMemo(
    () => (NATIVE_TIMEZONES.includes('UTC') ? NATIVE_TIMEZONES : ['UTC', ...NATIVE_TIMEZONES]),
    [],
  )

  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estado de ubicación (se deriva del perfil al cargar).
  const [countryIso, setCountryIso] = useState('')
  const [cityName, setCityName] = useState('')
  const [customCity, setCustomCity] = useState('')
  const [timezone, setTimezone] = useState('')

  // Teléfono: prefijo (ISO del país) + número.
  const [phoneIso, setPhoneIso] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [emergencyIso, setEmergencyIso] = useState('')
  const [emergencyNumber, setEmergencyNumber] = useState('')

  const availableCities = useMemo(
    () => (countryIso ? City.getCitiesOfCountry(countryIso) || [] : []),
    [countryIso],
  )

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getMyPatientProfile()
        setProfile(data)

        const matchedCountry = allCountries.find((country) => normalize(country.name) === normalize(data.country || ''))
        const iso = matchedCountry?.isoCode || ''
        setCountryIso(iso)

        const cities = iso ? City.getCitiesOfCountry(iso) || [] : []
        if (data.city && cities.some((city) => city.name === data.city)) {
          setCityName(data.city)
          setCustomCity('')
        } else if (data.city) {
          setCityName('Otra')
          setCustomCity(data.city)
        }

        setTimezone(data.timezone || '')

        const phone = parsePhone(data.phone, allCountries)
        setPhoneIso(phone.iso || iso)
        setPhoneNumber(phone.number)

        const emergency = parsePhone(data.emergency_contact_phone, allCountries)
        setEmergencyIso(emergency.iso || iso)
        setEmergencyNumber(emergency.number)
      } catch (err: unknown) {
        const requestError = err as { response?: { data?: { detail?: string } } }
        setError(requestError.response?.data?.detail || 'No se pudo cargar tu perfil.')
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = <K extends keyof PatientProfile>(field: K, value: PatientProfile[K]) => {
    setProfile((current) => (current ? { ...current, [field]: value } : current))
  }

  const handleCountryChange = (iso: string) => {
    setCountryIso(iso)
    const cities = iso ? City.getCitiesOfCountry(iso) || [] : []
    if (cities.length > 0) {
      setCityName(cities[0].name)
      setCustomCity('')
    } else {
      setCityName('Otra')
      setCustomCity('')
    }
    // Sugerimos el prefijo telefónico del país si aún no hay uno elegido.
    if (iso) {
      setPhoneIso((current) => current || iso)
      setEmergencyIso((current) => current || iso)
    }
  }

  const buildPhone = (iso: string, number: string): string | null => {
    const value = number.trim()
    if (!value) return null
    const country = allCountries.find((item) => item.isoCode === iso)
    return country ? `+${country.phonecode} ${value}`.trim() : value
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile) return
    setSaving(true)
    setError(null)
    try {
      const finalCity =
        availableCities.length > 0 && cityName !== 'Otra'
          ? cityName
          : customCity.trim() || (countryIso ? '' : profile.city || '')
      const finalCountry =
        allCountries.find((country) => country.isoCode === countryIso)?.name ||
        (countryIso ? null : profile.country || null)

      const payload: PatientProfilePayload = {
        first_name: profile.first_name?.trim() || null,
        last_name: profile.last_name?.trim() || null,
        date_of_birth: profile.date_of_birth || null,
        sex: profile.sex || null,
        phone: buildPhone(phoneIso, phoneNumber),
        country: finalCountry,
        city: finalCity || null,
        timezone: timezone || null,
        blood_type: profile.blood_type || null,
        allergies: profile.allergies?.trim() || null,
        chronic_conditions: profile.chronic_conditions?.trim() || null,
        current_medications: profile.current_medications?.trim() || null,
        family_history: profile.family_history?.trim() || null,
        height_cm: profile.height_cm ?? null,
        weight_kg: profile.weight_kg ?? null,
        smoker: profile.smoker ?? null,
        alcohol: profile.alcohol ?? null,
        emergency_contact_name: profile.emergency_contact_name?.trim() || null,
        emergency_contact_phone: buildPhone(emergencyIso, emergencyNumber),
        notes: profile.notes?.trim() || null,
      }
      const updated = await updateMyPatientProfile(payload)
      setProfile(updated)
      // Actualiza el menú de usuario para que muestre el nuevo nombre.
      await refreshUser()
      toast.success('Perfil guardado. El médico y la IA usarán estos datos para atenderte mejor.')
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'No se pudo guardar el perfil.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Cargando perfil...
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl">
        <BackButton />
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error || 'No se pudo cargar el perfil.'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackButton />

      <div>
        <div className="flex items-center gap-2">
          <UserRound className="h-6 w-6 text-primary-600" />
          <h1 className="text-3xl font-bold text-slate-900">Mi perfil de paciente</h1>
        </div>
        <p className="mt-2 text-slate-600">
          Completa tus datos personales y clínicos. Ayudan al médico a reconocerte y a la IA a darte respuestas más
          precisas. Todo es opcional.
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={handleSave} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Datos personales</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              label="Nombres"
              value={profile.first_name ?? ''}
              onChange={(e) => set('first_name', e.target.value)}
              autoComplete="given-name"
            />
            <Input
              label="Apellidos"
              value={profile.last_name ?? ''}
              onChange={(e) => set('last_name', e.target.value)}
              autoComplete="family-name"
            />
            <Input
              label="Fecha de nacimiento"
              type="date"
              value={profile.date_of_birth ?? ''}
              onChange={(e) => set('date_of_birth', e.target.value || null)}
            />
            <Select
              label="Sexo"
              value={profile.sex ?? ''}
              onChange={(e) => set('sex', (e.target.value || null) as PatientSex | null)}
            >
              <option value="">Sin especificar</option>
              {SEX_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Select label="País" value={countryIso} onChange={(e) => handleCountryChange(e.target.value)}>
              <option value="">Selecciona un país</option>
              {allCountries.map((country) => (
                <option key={country.isoCode} value={country.isoCode}>
                  {country.name}
                </option>
              ))}
            </Select>

            {availableCities.length === 0 ? (
              <Input
                label="Ciudad"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                placeholder="Escribe tu ciudad"
              />
            ) : (
              <Select label="Ciudad" value={cityName} onChange={(e) => setCityName(e.target.value)}>
                <option value="">Selecciona una ciudad</option>
                {availableCities.map((city) => (
                  <option key={city.name} value={city.name}>
                    {city.name}
                  </option>
                ))}
                <option value="Otra">Otra…</option>
              </Select>
            )}

            {cityName === 'Otra' && availableCities.length > 0 && (
              <Input
                label="Especifica tu ciudad"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                placeholder="Escribe tu ciudad"
              />
            )}

            <div className="md:col-span-2">
              <Select label="Zona horaria" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="">Sin especificar</option>
                {timezones.map((zone: string) => (
                  <option key={zone} value={zone}>
                    {zone.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-2">
              <Field label="Teléfono" htmlFor="patient-phone">
                <div className="flex gap-2">
                  <select
                    aria-label="Código de país"
                    className="input-field flex-none bg-white"
                    style={{ width: '170px' }}
                    value={phoneIso}
                    onChange={(e) => setPhoneIso(e.target.value)}
                  >
                    <option value="">Código</option>
                    {allCountries.map((country) => (
                      <option key={country.isoCode} value={country.isoCode}>
                        +{country.phonecode} {country.name}
                      </option>
                    ))}
                  </select>
                  <input
                    id="patient-phone"
                    type="tel"
                    inputMode="tel"
                    className="input-field min-w-0 flex-1"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="999 888 777"
                  />
                </div>
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Datos clínicos</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Select
              label="Grupo sanguíneo"
              value={profile.blood_type ?? ''}
              onChange={(e) => set('blood_type', e.target.value || null)}
            >
              <option value="">Sin especificar</option>
              {BLOOD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
            <Input
              label="Altura (cm)"
              type="number"
              min={30}
              max={260}
              value={profile.height_cm ?? ''}
              onChange={(e) => set('height_cm', e.target.value ? Number(e.target.value) : null)}
            />
            <Input
              label="Peso (kg)"
              type="number"
              min={2}
              max={500}
              value={profile.weight_kg ?? ''}
              onChange={(e) => set('weight_kg', e.target.value ? Number(e.target.value) : null)}
            />
            <fieldset className="flex items-end gap-6 md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  checked={profile.smoker ?? false}
                  onChange={(e) => set('smoker', e.target.checked)}
                />
                Fumador
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  checked={profile.alcohol ?? false}
                  onChange={(e) => set('alcohol', e.target.checked)}
                />
                Consume alcohol
              </label>
            </fieldset>
            <div className="md:col-span-2">
              <Textarea
                label="Alergias"
                className="min-h-20"
                value={profile.allergies ?? ''}
                onChange={(e) => set('allergies', e.target.value)}
                placeholder="Medicamentos, alimentos, etc."
              />
            </div>
            <div className="md:col-span-2">
              <Textarea
                label="Enfermedades crónicas"
                className="min-h-20"
                value={profile.chronic_conditions ?? ''}
                onChange={(e) => set('chronic_conditions', e.target.value)}
                placeholder="Diabetes, hipertensión, asma, etc."
              />
            </div>
            <div className="md:col-span-2">
              <Textarea
                label="Medicación actual"
                className="min-h-20"
                value={profile.current_medications ?? ''}
                onChange={(e) => set('current_medications', e.target.value)}
                placeholder="Nombre y dosis de los medicamentos que tomas."
              />
            </div>
            <div className="md:col-span-2">
              <Textarea
                label="Antecedentes familiares"
                className="min-h-20"
                value={profile.family_history ?? ''}
                onChange={(e) => set('family_history', e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Contacto de emergencia y notas</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              label="Nombre del contacto"
              value={profile.emergency_contact_name ?? ''}
              onChange={(e) => set('emergency_contact_name', e.target.value)}
            />
            <Field label="Teléfono del contacto" htmlFor="emergency-phone">
              <div className="flex gap-2">
                <select
                  aria-label="Código de país"
                  className="input-field flex-none bg-white"
                  style={{ width: '170px' }}
                  value={emergencyIso}
                  onChange={(e) => setEmergencyIso(e.target.value)}
                >
                  <option value="">Código</option>
                  {allCountries.map((country) => (
                    <option key={country.isoCode} value={country.isoCode}>
                      +{country.phonecode} {country.name}
                    </option>
                  ))}
                </select>
                <input
                  id="emergency-phone"
                  type="tel"
                  inputMode="tel"
                  className="input-field min-w-0 flex-1"
                  value={emergencyNumber}
                  onChange={(e) => setEmergencyNumber(e.target.value)}
                  placeholder="999 888 777"
                />
              </div>
            </Field>
            <div className="md:col-span-2">
              <Textarea
                label="Notas adicionales"
                className="min-h-20"
                value={profile.notes ?? ''}
                onChange={(e) => set('notes', e.target.value)}
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" loading={saving} leftIcon={<Save className="h-4 w-4" />}>
            Guardar perfil
          </Button>
        </div>
      </form>
    </div>
  )
}
