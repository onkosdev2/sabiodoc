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

export type AdminUserRole = 'patient' | 'doctor' | 'reviewer' | 'admin' | 'support'

export interface AdminUser {
  id: number
  email: string
  full_name: string | null
  role: AdminUserRole
  roles: AdminUserRole[]
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
  roles: AdminUserRole[]
}

export interface AdminUserUpdatePayload {
  email?: string
  password?: string
  roles?: AdminUserRole[]
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

export interface SupportCounterpart {
  user_id: number | null
  name: string | null
  email: string | null
  role: 'doctor' | 'patient' | string | null
}

export interface SupportDoctorProfile {
  doctor_id: number
  display_name: string
  professional_title: string | null
  price_per_min_cents: number
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  rating_avg: number
  rating_count: number
  is_accepting_consultations: boolean
  specialties: string[]
}

export interface SupportUserSummary {
  id: number
  email: string
  roles: AdminUserRole[]
  primary_role: AdminUserRole
  doctor_status: 'pending' | 'approved' | 'rejected' | 'suspended' | null
  is_email_verified: boolean
  created_at: string | null
  session_version: number
}

export interface SupportStats {
  appointments_total: number
  appointments_completed: number
  appointments_no_show: number
  video_sessions_total: number
  consultations_total: number
  unread_notifications: number
  errors_total: number
}

export interface SupportAppointmentItem {
  id: number
  specialty_name: string
  status: string
  scheduled_at: string
  duration_minutes: number
  counterpart: SupportCounterpart
  payment_amount_cents: number | null
  payment_status: string | null
  payment_doctor_amount_cents: number | null
  video_session_id: number | null
  created_at: string | null
}

export interface SupportVideoSessionItem {
  id: number
  status: string
  provider: string
  room_name: string
  counterpart: SupportCounterpart
  appointment_id: number | null
  consultation_id: number | null
  created_at: string | null
  started_at: string | null
  ended_at: string | null
  billable_seconds: number
  price_per_min_cents: number
  prepaid_amount_cents: number
  closed_reason: string | null
}

export interface SupportConsultationItem {
  id: number
  status: string
  specialty_name: string
  created_at: string | null
  closed_at: string | null
  auto_closed: boolean
  has_summary: boolean
}

export interface SupportWalletTransaction {
  id: number
  type: string
  status: string
  amount_cents: number
  balance_after_cents: number
  description: string
  reference_type: string | null
  reference_id: number | null
  created_at: string | null
}

export interface SupportWithdrawal {
  id: number
  amount_cents: number
  status: string
  destination: string
  provider: string | null
  provider_reference: string | null
  failure_reason: string | null
  created_at: string | null
}

export interface SupportErrorItem {
  id: number
  created_at: string | null
  level: string
  source: string
  status_code: number | null
  method: string | null
  path: string | null
  error_type: string | null
  message: string
  request_id: string | null
  video_session_id: number | null
}

export interface SupportNotificationItem {
  id: number
  type: string
  title: string
  body: string
  action_url: string | null
  created_at: string | null
}

export interface AdminUserSupport {
  user: SupportUserSummary
  doctor_profile: SupportDoctorProfile | null
  active_session: SupportVideoSessionItem | null
  next_appointment: SupportAppointmentItem | null
  stats: SupportStats
  appointments: SupportAppointmentItem[]
  video_sessions: SupportVideoSessionItem[]
  consultations: SupportConsultationItem[]
  wallet_balance_cents: number
  transactions: SupportWalletTransaction[]
  withdrawals: SupportWithdrawal[]
  errors: SupportErrorItem[]
  notifications: SupportNotificationItem[]
}

/** Vista de soporte 360° de un usuario (citas, videoconsultas, monedero, errores...). */
export const getAdminUserSupport = async (userId: number): Promise<AdminUserSupport> => {
  const response = await client.get<AdminUserSupport>(`/admin/users/${userId}/support`)
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
