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
