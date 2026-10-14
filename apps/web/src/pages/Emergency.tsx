import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Globe, MapPin, Phone } from 'lucide-react'

import BackButton from '../components/BackButton'
import Alert from '../components/ui/Alert'
import Card from '../components/ui/Card'
import { useAuth } from '../context/AuthContext'
import { Country, localizedCountryName } from '../utils/locations'
import {
  EMERGENCY_COUNTRY_CODES,
  EMERGENCY_LAST_REVIEWED,
  OTHER_COUNTRY_CODE,
  getEmergencyCountry,
  inferEmergencyCountry,
} from '../utils/emergencyNumbers'

const STORAGE_KEY = 'sabiodoc-emergency-country'

const WHEN_TO_GO = [
  'Dolor en el pecho intenso o dificultad para respirar',
  'Signos de derrame cerebral: debilidad en un lado del cuerpo, dificultad para hablar, confusión repentina',
  'Sangrado abundante que no se detiene',
  'Pérdida de consciencia o desmayo',
  'Reacciones alérgicas severas (dificultad para respirar, hinchazón de cara o garganta)',
  'Convulsiones',
  'Lesiones graves por accidentes',
  'Fiebre muy alta (especialmente en niños pequeños)',
]

const WHAT_TO_DO = [
  'Mantén la calma',
  'Llama al número de emergencias de tu país',
  'Sigue las instrucciones del operador',
  'No muevas a la persona si sospechas una lesión de columna',
]

function initialCountry(): string {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) return stored
  }
  return inferEmergencyCountry() ?? 'PE'
}

/** Normaliza nombres de país para comparar ("Perú" == "Peru"). */
const normalizeName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

export default function Emergency() {
  const { user } = useAuth()
  const [countryCode, setCountryCode] = useState<string>(initialCountry)
  const country = useMemo(() => getEmergencyCountry(countryCode), [countryCode])

  // País de la cuenta (nombre) -> ISO, usando el mismo dataset que el perfil.
  const accountCode = useMemo(() => {
    const name = user?.country
    if (!name) return null
    const countries = Country.getAllCountries()
    const match = countries.find(
      (item) =>
        normalizeName(item.name) === normalizeName(name) ||
        item.isoCode === name.trim().toUpperCase(),
    )
    return match?.isoCode ?? null
  }, [user?.country])

  // Si la cuenta tiene país, se selecciona automáticamente (o "Otro país" si no
  // tenemos números verificados). El usuario puede cambiarlo manualmente.
  useEffect(() => {
    if (!accountCode) return
    setCountryCode(getEmergencyCountry(accountCode) ? accountCode : OTHER_COUNTRY_CODE)
  }, [accountCode])

  const handleCountryChange = (code: string) => {
    setCountryCode(code)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, code)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BackButton />

      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-full bg-red-100 p-3">
            <AlertTriangle className="h-10 w-10 text-red-600" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-red-800">Información de emergencias</h1>
            <p className="text-red-700">Si tienes una emergencia médica, actúa rápidamente</p>
          </div>
        </div>

        <Card className="mb-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">¿Cuándo acudir a urgencias?</h2>
          <ul className="space-y-3 text-slate-700">
            {WHEN_TO_GO.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mb-6">
          <div className="mb-3 flex items-center gap-3">
            <Globe className="h-6 w-6 text-red-600" aria-hidden="true" />
            <h3 className="font-semibold text-slate-800">Elige tu país</h3>
          </div>
          <label htmlFor="emergency-country" className="sr-only">
            País
          </label>
          <select
            id="emergency-country"
            value={countryCode}
            onChange={(event) => handleCountryChange(event.target.value)}
            className="input-field max-w-xs bg-white"
          >
            {EMERGENCY_COUNTRY_CODES.map((code) => (
              <option key={code} value={code}>
                {getEmergencyCountry(code)?.name ?? code}
              </option>
            ))}
            <option value={OTHER_COUNTRY_CODE}>Otro país</option>
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Los números se muestran según el país elegido. Última revisión: {EMERGENCY_LAST_REVIEWED}.
            {user?.country
              ? ` Seleccionado según tu cuenta (${localizedCountryName(accountCode ?? '', user.country)}); puedes cambiarlo.`
              : ''}
          </p>
        </Card>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <Phone className="h-6 w-6 text-red-600" aria-hidden="true" />
              <h3 className="font-semibold text-slate-800">
                Números de emergencia{country ? ` · ${country.name}` : ''}
              </h3>
            </div>

            {country ? (
              <>
                {country.headline && (
                  <p className="mb-2 text-sm text-slate-600">{country.headline}</p>
                )}
                <ul className="space-y-2 text-slate-700">
                  {country.numbers.map((item) => (
                    <li key={item.label}>
                      <strong>{item.label}:</strong>{' '}
                      {item.tel ? (
                        <a href={`tel:${item.tel}`} className="font-medium text-red-700 hover:underline">
                          {item.tel}
                        </a>
                      ) : (
                        <span>consulta tu número local</span>
                      )}
                    </li>
                  ))}
                </ul>
                {country.note && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {country.note}
                  </p>
                )}
                {country.sourceUrl && (
                  <p className="mt-2 text-xs text-slate-500">
                    Fuente:{' '}
                    <a
                      href={country.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {country.sourceLabel ?? country.sourceUrl}
                    </a>
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-2 text-sm text-slate-700">
                <p>
                  No tenemos números verificados para el país seleccionado. Busca el número oficial de
                  emergencias local (ambulancia/SAMU, bomberos, policía) o acude directamente al hospital
                  más cercano.
                </p>
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Verifica siempre el número con una fuente oficial: puede cambiar.
                </p>
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-3">
              <MapPin className="h-6 w-6 text-red-600" aria-hidden="true" />
              <h3 className="font-semibold text-slate-800">Qué hacer</h3>
            </div>
            <ol className="space-y-2 text-slate-700">
              {WHAT_TO_DO.map((item, index) => (
                <li key={item} className="flex gap-2">
                  <span className="font-semibold text-red-600">{index + 1}.</span>
                  {item}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Alert tone="warning" title="Importante">
          SabioDoc es una herramienta de orientación y <strong>no puede atender emergencias médicas</strong>. Si crees
          que tienes una emergencia, no uses esta aplicación: llama al número de emergencias de tu país o acude
          directamente al hospital más cercano.
        </Alert>
      </div>
    </div>
  )
}
