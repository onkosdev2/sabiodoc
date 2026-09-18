import client from './client'

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
  doctor_note: string | null
  followup_instructions: string | null
  intro_script: string | null
  closed_reason: string | null
}

export const getVideoSessionStatus = async (videoSessionId: number): Promise<VideoSessionStatus> => {
  const response = await client.get<VideoSessionStatus>(`/video-sessions/${videoSessionId}`)
  return response.data
}

export const joinVideoSession = async (videoSessionId: number): Promise<VideoSessionStatus> => {
  const response = await client.post<VideoSessionStatus>(`/video-sessions/${videoSessionId}/join`)
  return response.data
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
