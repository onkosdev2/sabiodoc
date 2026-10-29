import client, { API_URL } from './client'
import { getStoredToken } from '../utils/authStorage'

export interface VideoSessionFile {
  id: number
  video_session_id: number | null
  appointment_id: number | null
  uploader_id: number
  uploader_role: 'patient' | 'doctor'
  original_name: string
  content_type: string | null
  resource_type: string
  file_format: string | null
  bytes: number
  url: string
  secure_url: string
  created_at: string | null
}

export interface VideoSessionStatus {
  video_session_id: number
  consultation_id: number | null
  appointment_id: number | null
  patient_id: number
  patient_email: string
  patient_name: string | null
  status:
    | 'prepared'
    | 'active'
    | 'extension_pending'
    | 'extension_requested'
    | 'completed'
    | 'cancelled'
    | 'expired'
    | 'failed'
  provider: 'jitsi' | 'jitsi_mock'
  participant_role: 'patient' | 'doctor'
  room_name: string
  started_at: string | null
  ended_at: string | null
  joined_patient_at: string | null
  joined_doctor_at: string | null
  expires_at: string
  estimated_minutes: number
  billable_seconds: number
  elapsed_seconds: number
  remaining_seconds: number
  price_per_min_cents: number
  platform_fee_cents: number
  doctor_amount_cents: number
  platform_fee_bps: number
  patient_present: boolean
  doctor_present: boolean
  both_present: boolean
  jitsi_required: boolean
  jitsi_patient_present: boolean
  jitsi_doctor_present: boolean
  both_in_jitsi: boolean
  jitsi_patient_joined_at: string | null
  jitsi_doctor_joined_at: string | null
  payment_state: 'pending' | 'requires_action' | 'paid' | 'failed'
  payment_amount_cents: number
  payment_minutes: number
  payment_failure_code: string | null
  payment_failure_message: string | null
  payment_next_action: string | null
  extension_request_pending: boolean
  extension_requested_minutes: number
  extension_requested_amount_cents: number
  extension_request_expires_at: string | null
  doctor_note: string | null
  followup_instructions: string | null
  intro_script: string | null
  closed_reason: string | null
  files_enabled: boolean
  files: VideoSessionFile[]
}

export const getVideoSessionStatus = async (videoSessionId: number): Promise<VideoSessionStatus> => {
  const response = await client.get<VideoSessionStatus>(`/video-sessions/${videoSessionId}`)
  return response.data
}

export const joinVideoSession = async (videoSessionId: number): Promise<VideoSessionStatus> => {
  const response = await client.post<VideoSessionStatus>(`/video-sessions/${videoSessionId}/join`)
  return response.data
}

/** Reporta la entrada/salida real de la conferencia de Jitsi (best-effort). */
export const reportJitsiEvent = async (
  videoSessionId: number,
  event: 'joined' | 'left' | 'heartbeat',
): Promise<void> => {
  try {
    await client.post(`/video-sessions/${videoSessionId}/jitsi-event`, { event })
  } catch {
    /* best-effort: no debe romper la videollamada */
  }
}

/** Variante con `keepalive` para el cierre de pestaña/navegación. */
export const reportJitsiEventBeacon = (videoSessionId: number, event: 'joined' | 'left'): void => {
  try {
    const token = getStoredToken()
    if (!token) return
    const url = `${API_URL}/video-sessions/${videoSessionId}/presence-beacon`
    const form = new FormData()
    form.append('token', token)
    form.append('event', event)

    // sendBeacon con FormData evita el preflight CORS que suele cancelarse al
    // cerrar o abandonar la pestaña.
    if (navigator.sendBeacon?.(url, form)) return
    void fetch(url, { method: 'POST', body: form, keepalive: true }).catch(() => {
      /* silencioso */
    })
  } catch {
    /* silencioso */
  }
}

export const listVideoSessionFiles = async (videoSessionId: number): Promise<VideoSessionFile[]> => {
  const response = await client.get<VideoSessionFile[]>(`/video-sessions/${videoSessionId}/files`)
  return response.data
}

export const uploadVideoSessionFile = async (
  videoSessionId: number,
  file: File,
): Promise<VideoSessionFile> => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await client.post<VideoSessionFile>(
    `/video-sessions/${videoSessionId}/files`,
    formData,
  )
  return response.data
}

export const startVideoSession = async (videoSessionId: number): Promise<VideoSessionStatus> => {
  const response = await client.post<VideoSessionStatus>(`/video-sessions/${videoSessionId}/start`)
  return response.data
}

export const confirmVideoSessionPayment = async (videoSessionId: number): Promise<VideoSessionStatus> => {
  const response = await client.post<VideoSessionStatus>(`/video-sessions/${videoSessionId}/confirm-payment`)
  return response.data
}

export const pauseVideoSession = async (videoSessionId: number): Promise<VideoSessionStatus> => {
  const response = await client.post<VideoSessionStatus>(`/video-sessions/${videoSessionId}/pause`)
  return response.data
}

export const generateVideoSessionIntro = async (videoSessionId: number): Promise<VideoSessionStatus> => {
  const response = await client.post<VideoSessionStatus>(`/video-sessions/${videoSessionId}/intro`)
  return response.data
}

/** El médico solicita una ampliación; queda pendiente de confirmación del paciente. */
export const requestVideoSessionExtension = async (
  videoSessionId: number,
  minutes: number,
): Promise<VideoSessionStatus> => {
  const response = await client.post<VideoSessionStatus>(`/video-sessions/${videoSessionId}/extend`, {
    minutes,
  })
  return response.data
}

/** El paciente confirma la ampliación y se ejecuta el cobro. */
export const confirmVideoSessionExtension = async (
  videoSessionId: number,
): Promise<VideoSessionStatus> => {
  const response = await client.post<VideoSessionStatus>(
    `/video-sessions/${videoSessionId}/extend/confirm`,
  )
  return response.data
}

export const rejectVideoSessionExtension = async (
  videoSessionId: number,
): Promise<VideoSessionStatus> => {
  const response = await client.post<VideoSessionStatus>(
    `/video-sessions/${videoSessionId}/extend/reject`,
  )
  return response.data
}

export const cancelVideoSessionExtension = async (
  videoSessionId: number,
): Promise<VideoSessionStatus> => {
  const response = await client.post<VideoSessionStatus>(
    `/video-sessions/${videoSessionId}/extend/cancel`,
  )
  return response.data
}

export const leaveVideoSession = async (videoSessionId: number): Promise<VideoSessionStatus> => {
  const response = await client.post<VideoSessionStatus>(`/video-sessions/${videoSessionId}/leave`)
  return response.data
}

export const updateVideoSessionDoctorNote = async (
  videoSessionId: number,
  payload: { doctor_note?: string }
): Promise<VideoSessionStatus> => {
  const response = await client.patch<VideoSessionStatus>(`/video-sessions/${videoSessionId}/doctor-note`, payload)
  return response.data
}

export const completeVideoSession = async (
  videoSessionId: number,
  payload: { doctor_note?: string; followup_instructions?: string; closed_reason?: string }
): Promise<VideoSessionStatus> => {
  const response = await client.post<VideoSessionStatus>(`/video-sessions/${videoSessionId}/complete`, payload)
  return response.data
}
