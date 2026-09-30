import client from './client'
import type { AppointmentListResponse, AppointmentStatus } from './appointments'
import type { Specialty, SpecialtyListResponse } from './specialties'

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
  patient_name: string | null
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

export const getAdminAppointments = async (status?: AppointmentStatus): Promise<AppointmentListResponse> => {
  const response = await client.get<AppointmentListResponse>('/admin/appointments', {
    params: status ? { status_filter: status } : {},
  })
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
  full_name: string | null
  role: AdminUserRole
  doctor_status: 'pending' | 'approved' | 'rejected' | 'suspended' | null
  is_reviewer: boolean
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
  is_reviewer?: boolean
}

export interface AdminUserUpdatePayload {
  email?: string
  password?: string
  role?: AdminUserRole
  is_reviewer?: boolean
}

export interface AdminUserQuery {
  role?: AdminUserRole
  is_reviewer?: boolean
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

export interface LlmProviderHealth {
  name: string
  model: string
  status: 'ok' | 'error'
  latency_ms?: number
  detail?: string
}

export interface LlmHealthResponse {
  healthy: boolean
  mode: 'live' | 'mock'
  providers: LlmProviderHealth[]
}

export const getLlmHealth = async (): Promise<LlmHealthResponse> => {
  const response = await client.get<LlmHealthResponse>('/admin/ai/status')
  return response.data
}

export interface SpecialtyPayload {
  name: string
  slug?: string | null
  description?: string | null
  keywords?: string[]
  is_top?: boolean
}

export const getAdminSpecialties = async (): Promise<SpecialtyListResponse> => {
  const response = await client.get<SpecialtyListResponse>('/admin/specialties')
  return response.data
}

export const createAdminSpecialty = async (payload: SpecialtyPayload): Promise<Specialty> => {
  const response = await client.post<Specialty>('/admin/specialties', payload)
  return response.data
}

export const updateAdminSpecialty = async (
  specialtyId: number,
  payload: Partial<SpecialtyPayload>,
): Promise<Specialty> => {
  const response = await client.patch<Specialty>(`/admin/specialties/${specialtyId}`, payload)
  return response.data
}

export const deleteAdminSpecialty = async (specialtyId: number): Promise<void> => {
  await client.delete(`/admin/specialties/${specialtyId}`)
}

export interface AdminReviewItem {
  id: number
  rating: number
  comment: string | null
  doctor_id: number
  doctor_name: string | null
  is_hidden: boolean
  hidden_reason: string | null
  reports_count: number
  created_at: string
}

export interface AdminReviewReportItem {
  id: number
  review_id: number
  reporter_email: string
  reason: string | null
  status: 'pending' | 'resolved' | 'dismissed'
  created_at: string
  resolved_at: string | null
  review: AdminReviewItem
}

export interface AdminReviewReportListResponse {
  reports: AdminReviewReportItem[]
  total: number
}

export interface AdminReviewListResponse {
  reviews: AdminReviewItem[]
  total: number
}

export type ReviewReportStatus = 'pending' | 'resolved' | 'dismissed'

export const getReviewReports = async (
  status?: ReviewReportStatus,
): Promise<AdminReviewReportListResponse> => {
  const response = await client.get<AdminReviewReportListResponse>('/admin/review-reports', {
    params: status ? { report_status: status } : {},
  })
  return response.data
}

export const updateReviewReportStatus = async (
  reportId: number,
  status: Exclude<ReviewReportStatus, 'pending'>,
): Promise<AdminReviewReportItem> => {
  const response = await client.post<AdminReviewReportItem>(
    `/admin/review-reports/${reportId}/status`,
    { status },
  )
  return response.data
}

export const hideReview = async (reviewId: number, reason?: string): Promise<AdminReviewItem> => {
  const response = await client.post<AdminReviewItem>(`/admin/reviews/${reviewId}/hide`, {
    reason: reason?.trim() || null,
  })
  return response.data
}

export const unhideReview = async (reviewId: number): Promise<AdminReviewItem> => {
  const response = await client.post<AdminReviewItem>(`/admin/reviews/${reviewId}/unhide`)
  return response.data
}
