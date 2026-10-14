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

/** Etiqueta legible de una zona horaria IANA, p. ej. "Lima (GMT-5)". */
export function timeZoneLabel(timeZone: string, date: Date = new Date()): string {
  if (!timeZone) return ''
  const city = timeZone.split('/').pop()?.replace(/_/g, ' ') ?? timeZone
  try {
    const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value
    return offset ? `${city} (${offset})` : city
  } catch {
    return city
  }
}
