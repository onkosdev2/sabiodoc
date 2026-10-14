/**
 * Números de emergencia por país.
 *
 * Solo se incluyen países con números ampliamente documentados. Para el resto
 * se muestra un bloque genérico ("Otro país") que invita a verificar el número
 * oficial local: es preferible a publicar un número incorrecto.
 *
 * IMPORTANTE: este contenido debe revisarse editorialmente con periodicidad.
 */
export interface EmergencyNumber {
  label: string
  /** Número marcable (si existe). */
  tel?: string
  /** Nota corta bajo el número. */
  note?: string
}

export interface EmergencyCountryInfo {
  code: string
  name: string
  headline?: string
  numbers: EmergencyNumber[]
  note?: string
  sourceLabel?: string
  sourceUrl?: string
}

export const EMERGENCY_LAST_REVIEWED = 'octubre de 2026'

export const EMERGENCY_BY_COUNTRY: Record<string, EmergencyCountryInfo> = {
  PE: {
    code: 'PE',
    name: 'Perú',
    headline: 'En Perú usa las líneas oficiales:',
    numbers: [
      { label: 'SAMU (urgencias médicas)', tel: '106' },
      { label: 'Bomberos', tel: '116' },
      { label: 'Policía', tel: '105' },
      { label: 'Defensa Civil (INDECI)', tel: '115' },
      { label: 'Orientación en salud (MINSA)', tel: '113' },
    ],
    note: 'La central 911 continúa en implementación y pruebas en el país; no la uses como único número.',
    sourceLabel: 'gob.pe (MINSA)',
    sourceUrl: 'https://www.gob.pe/1013',
  },
  CO: {
    code: 'CO',
    name: 'Colombia',
    numbers: [
      { label: 'Emergencias (línea única)', tel: '123' },
      { label: 'Cruz Roja', tel: '132' },
      { label: 'Bomberos', tel: '119' },
      { label: 'Policía', tel: '112' },
    ],
  },
  MX: {
    code: 'MX',
    name: 'México',
    numbers: [{ label: 'Emergencias (línea única)', tel: '911' }],
  },
  CL: {
    code: 'CL',
    name: 'Chile',
    numbers: [
      { label: 'SAMU (ambulancia)', tel: '131' },
      { label: 'Bomberos', tel: '132' },
      { label: 'Carabineros', tel: '133' },
      { label: 'PDI', tel: '134' },
    ],
  },
  AR: {
    code: 'AR',
    name: 'Argentina',
    numbers: [
      { label: 'Emergencias', tel: '911' },
      { label: 'SAME (ambulancia, CABA)', tel: '107' },
      { label: 'Bomberos', tel: '100' },
      { label: 'Policía', tel: '101' },
    ],
  },
  EC: {
    code: 'EC',
    name: 'Ecuador',
    numbers: [{ label: 'Emergencias (línea única)', tel: '911' }],
  },
  BR: {
    code: 'BR',
    name: 'Brasil',
    numbers: [
      { label: 'SAMU (ambulancia)', tel: '192' },
      { label: 'Bomberos', tel: '193' },
      { label: 'Policía Militar', tel: '190' },
    ],
  },
  ES: {
    code: 'ES',
    name: 'España',
    numbers: [{ label: 'Emergencias (línea única europea)', tel: '112' }],
  },
  US: {
    code: 'US',
    name: 'Estados Unidos',
    numbers: [{ label: 'Emergencias', tel: '911' }],
  },
}

export const OTHER_COUNTRY_CODE = 'OTHER'

/** Orden de países en el selector (primero el foco actual del producto). */
export const EMERGENCY_COUNTRY_CODES = [
  'PE',
  'CO',
  'MX',
  'CL',
  'AR',
  'EC',
  'BR',
  'ES',
  'US',
]

/** Códigos de país por zona horaria (para inferir sin pedir datos). */
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'America/Lima': 'PE',
  'America/Bogota': 'CO',
  'America/Mexico_City': 'MX',
  'America/Monterrey': 'MX',
  'America/Tijuana': 'MX',
  'America/Santiago': 'CL',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Guayaquil': 'EC',
  'America/Sao_Paulo': 'BR',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'Europe/Madrid': 'ES',
}

/** Infiere un código de país a partir del locale del navegador o la zona horaria. */
export function inferEmergencyCountry(): string | null {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const region = navigator.language.split('-')[1]?.toUpperCase()
    if (region && EMERGENCY_BY_COUNTRY[region]) return region
  }
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (timezone && TIMEZONE_TO_COUNTRY[timezone]) return TIMEZONE_TO_COUNTRY[timezone]
  } catch {
    /* Intl no disponible */
  }
  return null
}

export function getEmergencyCountry(code: string): EmergencyCountryInfo | null {
  return EMERGENCY_BY_COUNTRY[code] ?? null
}
