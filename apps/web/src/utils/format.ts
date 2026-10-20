/** Formateo compartido de dinero, fechas y horas. */

export function formatMoney(amountCents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amountCents / 100)
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('es-ES')
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('es-ES')
}

export function formatLongDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

// Zonas horarias prioritarias para el producto (Perú primero).
const PRIORITY_TIMEZONES = [
  'America/Lima',
  'America/Bogota',
  'America/Mexico_City',
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/Guayaquil',
  'America/Sao_Paulo',
  'Europe/Madrid',
  'America/New_York',
]

const CITY_NAMES: Record<string, string> = {
  Lima: 'Lima',
  Bogota: 'Bogotá',
  Mexico_City: 'Ciudad de México',
  Buenos_Aires: 'Buenos Aires',
  Santiago: 'Santiago',
  Guayaquil: 'Guayaquil',
  Sao_Paulo: 'São Paulo',
  Madrid: 'Madrid',
  New_York: 'Nueva York',
  Los_Angeles: 'Los Ángeles',
  Panama: 'Panamá',
}

/** Lista de zonas IANA con las prioritarias al inicio. */
export function getTimeZoneOptions(): string[] {
  const native = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf?.('timeZone')
  const all = native && native.length > 0 ? native : PRIORITY_TIMEZONES
  return Array.from(new Set([...PRIORITY_TIMEZONES, ...all]))
}

/** Etiqueta legible de una zona horaria IANA, p. ej. "Lima (UTC−5)". */
export function timeZoneLabel(timeZone: string, date: Date = new Date()): string {
  if (!timeZone) return ''
  const cityPart = timeZone.split('/').pop() ?? timeZone
  const city = CITY_NAMES[cityPart] ?? cityPart.replace(/_/g, ' ')
  try {
    const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value
    if (!offset) return city
    const normalized = offset.replace(/^GMT/, 'UTC').replace(/-/g, '−')
    return `${city} (${normalized})`
  } catch {
    return city
  }
}
