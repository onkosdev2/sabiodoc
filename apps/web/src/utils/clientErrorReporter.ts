import { API_URL } from '../api/client'
import { getStoredToken } from './authStorage'

export interface ClientErrorReportInput {
  message: string
  error?: unknown
  errorType?: string
  level?: 'error' | 'warning'
  videoSessionId?: number | null
  appointmentId?: number | null
  consultationId?: number | null
  context?: Record<string, unknown>
}

// Evita inundar el backend cuando el mismo error se repite en bucle.
const recentlyReported = new Map<string, number>()
const DEDUPE_WINDOW_MS = 15000

const errorFingerprint = (input: ClientErrorReportInput) =>
  `${input.errorType ?? ''}|${input.message}|${input.videoSessionId ?? ''}`

const extractStack = (error: unknown): string | undefined => {
  if (error instanceof Error && typeof error.stack === 'string') {
    return error.stack
  }
  return undefined
}

const extractType = (input: ClientErrorReportInput, error: unknown): string => {
  if (input.errorType) return input.errorType
  if (error instanceof Error && error.name) return error.name
  return 'ClientError'
}

const extractMessage = (input: ClientErrorReportInput, error: unknown): string => {
  if (input.message?.trim()) return input.message.trim()
  if (error instanceof Error && error.message) return error.message
  return String(error ?? 'Error desconocido en el navegador')
}

/**
 * Envía al backend un error que solo ocurre en el navegador (Jitsi, permisos,
 * red…). Es "fire-and-forget": nunca lanza ni bloquea la UI.
 */
export function reportClientError(input: ClientErrorReportInput): void {
  try {
    const fingerprint = errorFingerprint(input)
    const now = Date.now()
    const last = recentlyReported.get(fingerprint)
    if (last && now - last < DEDUPE_WINDOW_MS) {
      return
    }
    recentlyReported.set(fingerprint, now)
    if (recentlyReported.size > 100) {
      // Limpieza simple para no crecer sin límite.
      for (const [key, timestamp] of recentlyReported) {
        if (now - timestamp > DEDUPE_WINDOW_MS) recentlyReported.delete(key)
      }
    }

    const message = extractMessage(input, input.error)
    const payload = {
      message: message.slice(0, 4000),
      error_type: extractType(input, input.error).slice(0, 200),
      stack: extractStack(input.error)?.slice(0, 20000),
      level: input.level ?? 'error',
      video_session_id: input.videoSessionId ?? null,
      appointment_id: input.appointmentId ?? null,
      consultation_id: input.consultationId ?? null,
      context: {
        url: window.location.href,
        route: window.location.pathname,
        user_agent: navigator.userAgent,
        online: navigator.onLine,
        ...input.context,
      },
    }

    const token = getStoredToken()
    void fetch(`${API_URL}/client-errors/client-error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      // Permite que la petición termine aunque el usuario navegue o cierre la pestaña.
      keepalive: true,
    }).catch(() => {
      /* silencioso: reportar no debe romper nada */
    })
  } catch {
    /* silencioso */
  }
}
