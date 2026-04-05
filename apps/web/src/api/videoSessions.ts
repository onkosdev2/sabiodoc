import client from './client'

export interface VideoSessionStatus {
  video_session_id: number
  consultation_id: number | null
  appointment_id: number | null
  patient_id: number
  patient_email: string
  status: 'prepared' | 'active' | 'completed' | 'cancelled' | 'expired' | 'failed'
  provider: 'daily' | 'mock_daily'
  participant_role: 'patient' | 'doctor'
  room_name: string
  started_at: string | null
  ended_at: string | null
  joined_patient_at: string | null
  joined_doctor_at: string | null
  expires_at: string
  estimated_minutes: number
  elapsed_seconds: number
  remaining_seconds: number
  is_overtime: boolean
  doctor_note: string | null
  followup_instructions: string | null
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
