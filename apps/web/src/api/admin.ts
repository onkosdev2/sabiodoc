import client from './client'

export interface MarketplaceOverview {
  doctors_online: number
  doctors_busy: number
  pending_applications: number
  scheduled_appointments: number
  completed_appointments: number
  active_video_sessions: number
  failed_video_sessions: number
  no_show_appointments: number
  unread_notifications: number
}

export interface AdminLiveVideoSession {
  video_session_id: number
  appointment_id: number | null
  consultation_id: number | null
  doctor_name: string
  patient_email: string
  status: string
  started_at: string | null
  expires_at: string
  joined_patient_at: string | null
  joined_doctor_at: string | null
}

export interface AdminLiveVideoSessionListResponse {
  sessions: AdminLiveVideoSession[]
  total: number
}

export interface AdminIncident {
  type: string
  title: string
  created_at: string
  action_url: string | null
  entity_id: number | null
}

export interface AdminIncidentListResponse {
  incidents: AdminIncident[]
  total: number
}

export const getMarketplaceOverview = async (): Promise<MarketplaceOverview> => {
  const response = await client.get<MarketplaceOverview>('/admin/marketplace/overview')
  return response.data
}

export const getLiveVideoSessions = async (): Promise<AdminLiveVideoSessionListResponse> => {
  const response = await client.get<AdminLiveVideoSessionListResponse>('/admin/video-sessions/live')
  return response.data
}

export const getAdminIncidents = async (): Promise<AdminIncidentListResponse> => {
  const response = await client.get<AdminIncidentListResponse>('/admin/incidents')
  return response.data
}
