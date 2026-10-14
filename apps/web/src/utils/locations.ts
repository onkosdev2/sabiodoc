import Country from 'country-state-city/lib/country'

export { Country }

/**
 * Nombre de país localizado al español a partir de su código ISO.
 *
 * El dataset de `country-state-city` trae los nombres en inglés ("Peru",
 * "United States"); `Intl.DisplayNames` los traduce sin cargar tablas.
 */
const REGION_NAMES = (() => {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' })
  } catch {
    return null
  }
})()

export function localizedCountryName(isoCode: string, fallback?: string): string {
  const code = (isoCode || '').trim().toUpperCase()
  if (!code) return fallback ?? ''
  try {
    const name = REGION_NAMES?.of(code)
    // `Intl.DisplayNames` devuelve el propio código si no lo reconoce.
    if (name && name !== code) return name
  } catch {
    /* Intl no disponible */
  }
  return fallback ?? code
}

// El dataset de ciudades se divide por país en `public/cities/<ISO>.json`
// (ver scripts/generate-cities.mjs). Así solo se descarga el país seleccionado
// (KBs) en lugar del dataset completo (~8 MB).
const cityCache = new Map<string, string[]>()

/** Carga por demanda (y cachea) los nombres de ciudades de un país. */
export async function getCitiesOfCountry(countryCode: string): Promise<string[]> {
  if (!countryCode) return []

  const cached = cityCache.get(countryCode)
  if (cached) return cached

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}cities/${countryCode}.json`)
    if (!response.ok) throw new Error(`No se pudieron cargar las ciudades de ${countryCode}`)
    const cities = (await response.json()) as string[]
    cityCache.set(countryCode, cities)
    return cities
  } catch {
    // Si falla, el formulario cae al campo de texto libre para la ciudad.
    cityCache.set(countryCode, [])
    return []
  }
}
