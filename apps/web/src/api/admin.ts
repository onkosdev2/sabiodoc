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

export interface Reviewer {
  id: number
  email: string
  role: 'reviewer'
  created_at: string
}

export interface ReviewerListResponse {
  reviewers: Reviewer[]
  total: number
}

export const getReviewers = async (): Promise<ReviewerListResponse> => {
  const response = await client.get<ReviewerListResponse>('/admin/reviewers')
  return response.data
}

export const createReviewer = async (email: string, password?: string): Promise<Reviewer> => {
  const response = await client.post<Reviewer>('/admin/reviewers', { email, password })
  return response.data
}

export const revokeReviewer = async (userId: number): Promise<void> => {
  await client.delete(`/admin/reviewers/${userId}`)
}

export type AdminUserRole = 'patient' | 'doctor' | 'reviewer' | 'admin'

export interface AdminUser {
  id: number
  email: string
  role: AdminUserRole
  doctor_status: 'pending' | 'approved' | 'rejected' | 'suspended' | null
  created_at: string
}

export interface AdminUserListResponse {
  users: AdminUser[]
  total: number
}

export interface AdminUserCreatePayload {
  email: string
  password: string
  role: AdminUserRole
}

export interface AdminUserUpdatePayload {
  email?: string
  password?: string
  role?: AdminUserRole
}

export interface AdminUserQuery {
  role?: AdminUserRole
  search?: string
  limit?: number
  offset?: number
}

export const getAdminUsers = async (params: AdminUserQuery = {}): Promise<AdminUserListResponse> => {
  const response = await client.get<AdminUserListResponse>('/admin/users', { params })
  return response.data
}

export const getAdminUser = async (userId: number): Promise<AdminUser> => {
  const response = await client.get<AdminUser>(`/admin/users/${userId}`)
  return response.data
}

export const createAdminUser = async (payload: AdminUserCreatePayload): Promise<AdminUser> => {
  const response = await client.post<AdminUser>('/admin/users', payload)
  return response.data
}

export const updateAdminUser = async (
  userId: number,
  payload: AdminUserUpdatePayload
): Promise<AdminUser> => {
  const response = await client.patch<AdminUser>(`/admin/users/${userId}`, payload)
  return response.data
}

export const deleteAdminUser = async (userId: number): Promise<void> => {
  await client.delete(`/admin/users/${userId}`)
}
