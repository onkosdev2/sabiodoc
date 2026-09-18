/** Extrae un mensaje de error legible de un error de Axios/FastAPI. */
export function getApiErrorMessage(
  error: unknown,
  fallback = 'Ocurrió un error. Intenta de nuevo.',
): string {
  const err = error as {
    response?: { status?: number; data?: { detail?: unknown } }
    message?: string
  }

  const detail = err?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }

  // Errores de validación de FastAPI: [{ msg, loc, ... }]
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string }
    if (first?.msg) return first.msg
  }

  // Algunos endpoints devuelven { message: "..." }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const message = (detail as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }

  const status = err?.response?.status
  if (status === 400) return 'La solicitud no es válida. Revisa los datos.'
  if (status === 401) return 'Tu sesión expiró. Inicia sesión de nuevo.'
  if (status === 403) return 'No tienes permisos para esta acción.'
  if (status === 404) return 'No encontramos el recurso solicitado.'
  if (status === 409) return 'La acción no se pudo completar por un conflicto con el estado actual.'
  if (status && status >= 500) return 'El servidor tuvo un problema. Intenta más tarde.'

  if (!err?.response) return 'No pudimos conectar con el servidor. Revisa tu conexión.'

  return fallback
}
