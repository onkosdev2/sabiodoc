import client from './client'

export interface VideoSessionFile {
  id: number
  video_session_id: number
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
  status: 'prepared' | 'active' | 'completed' | 'cancelled' | 'expired' | 'failed'
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
  is_overtime: boolean
  price_per_min_cents: number
  held_amount_cents: number
  current_cost_cents: number
  overtime_amount_cents: number
  patient_balance_cents: number
  can_afford_overtime: boolean
  billing_mode: 'scheduled' | 'overtime' | 'exhausted'
  patient_present: boolean
  doctor_present: boolean
  both_present: boolean
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

export const deleteVideoSessionFile = async (
  videoSessionId: number,
  fileId: number,
): Promise<void> => {
  await client.delete(`/video-sessions/${videoSessionId}/files/${fileId}`)
}

export const startVideoSession = async (videoSessionId: number): Promise<VideoSessionStatus> => {
  const response = await client.post<VideoSessionStatus>(`/video-sessions/${videoSessionId}/start`)
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
