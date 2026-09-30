import client from './client'
import type { ConsultationStructuredIntake } from './consultations'
import type { VideoSessionFile } from './videoSessions'
import type { PatientProfileChangeRequest, PatientProfilePayload } from './patients'

export type DoctorPresenceStatus = 'offline' | 'online' | 'busy'

export interface DoctorPresence {
  status: DoctorPresenceStatus
  status_message: string | null
  last_seen_at: string | null
}

export interface DoctorAvailabilityPreview {
  starts_at: string
  ends_at: string
  duration_minutes: number
}

export interface DoctorCard {
  id: number
  user_id: number
  display_name: string
  professional_title: string | null
  bio_short: string | null
  price_per_min_cents: number
  rating_avg: string
  rating_count: number
  is_accepting_consultations: boolean
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  photo_url: string | null
  address: string | null
  is_verified: boolean
  next_available_at: string | null
  availability_preview: DoctorAvailabilityPreview[]
  presence: DoctorPresence
}

export interface DoctorListResponse {
  doctors: DoctorCard[]
  total: number
}

export interface DoctorReview {
  id: number
  rating: number
  comment: string | null
  patient_label: string
  is_verified: boolean
  is_hidden: boolean
  created_at: string
}

export interface DoctorDetail {
  id: number
  user_id: number
  display_name: string
  professional_title: string | null
  bio_short: string | null
  price_per_min_cents: number
  rating_avg: string
  rating_count: number
  is_accepting_consultations: boolean
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  presence: DoctorPresence
  years_experience: number | null
  city: string | null
  country: string | null
  address: string | null
  photo_url: string | null
  license_number: string | null
  license_country: string | null
  specialist_registry_number: string | null
  is_verified: boolean
  specialties: DoctorApplicationSpecialty[]
  reviews: DoctorReview[]
}

export interface DoctorVideoSession {
  video_session_id: number
  consultation_id: number | null
  appointment_id?: number | null
  patient_id: number
  status: 'prepared' | 'active' | 'completed' | 'cancelled' | 'expired' | 'failed'
  provider: 'jitsi' | 'jitsi_mock'
  room_name: string
  room_url: string | null
  doctor_token: string
  doctor_price_per_min_cents: number
  estimated_minutes: number
  prepaid_amount_cents: number
  expires_at: string
  created_at: string
  patient_email: string
  patient_name: string | null
  specialty_name: string
}

export interface DoctorVideoSessionListResponse {
  sessions: DoctorVideoSession[]
  total: number
}

export interface DoctorApplicationSpecialty {
  id: number
  slug: string
  name: string
}

export interface DoctorApplication {
  doctor_id: number
  user_id: number
  email: string
  display_name: string
  professional_title: string | null
  bio_short: string | null
  price_per_min_cents: number
  license_number: string | null
  license_country: string | null
  specialist_registry_number: string | null
  country: string | null
  city: string | null
  address: string | null
  timezone: string | null
  government_id: string | null
  years_experience: number | null
  photo_url: string | null
  is_accepting_consultations: boolean
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  review_notes: string | null
  specialties: DoctorApplicationSpecialty[]
  created_at: string
  updated_at: string
}

export interface DoctorProfileUpsertPayload {
  display_name: string
  professional_title: string
  bio_short?: string
  price_per_min_cents: number
  license_number: string
  license_country: string
  specialist_registry_number?: string
  country: string
  city: string
  address?: string
  timezone: string
  government_id: string
  years_experience: number
  specialty_ids: number[]
}

export interface DoctorApplicationListResponse {
  applications: DoctorApplication[]
  total: number
}

export interface DoctorApplicationStatusPayload {
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  review_notes?: string
}

export interface DoctorPatientTimelineItem {
  item_type: 'consultation' | 'appointment' | 'video_session'
  sort_at: string
  specialty_id: number
  specialty_name: string
  consultation_id: number | null
  appointment_id: number | null
  video_session_id?: number | null
  consultation_status: 'created' | 'active' | 'closed' | null
  appointment_status: 'scheduled' | 'completed' | 'cancelled' | 'no_show' | null
  video_session_status?: string | null
  summary: string | null
  intake: ConsultationStructuredIntake | null
  patient_note: string | null
  doctor_note: string | null
  followup_instructions: string | null
  review_rating: number | null
  review_comment: string | null
  scheduled_at: string | null
  completed_at: string | null
  created_at: string
  files: VideoSessionFile[]
}

export interface DoctorPatientTimeline {
  patient_id: number
  patient_email: string
  doctor_id: number
  can_view_history: boolean
  items: DoctorPatientTimelineItem[]
  total: number
  files_enabled: boolean
}

export const getDoctorsBySpecialty = async (slug: string): Promise<DoctorListResponse> => {
  const response = await client.get<DoctorListResponse>(`/doctors/specialty/${slug}`)
  return response.data
}

/** Heartbeat de presencia: mantiene al medico como "Disponible" mientras usa la app. */
export const heartbeatPresence = async (): Promise<DoctorPresence> => {
  const response = await client.post<DoctorPresence>('/doctors/presence/heartbeat')
  return response.data
}

export const getDoctorDetail = async (doctorId: number): Promise<DoctorDetail> => {
  const response = await client.get<DoctorDetail>(`/doctors/${doctorId}`)
  return response.data
}

export interface DoctorReviewsResponse {
  reviews: DoctorReview[]
  total: number
  rating_avg: number
  rating_count: number
}

export const getMyDoctorReviews = async (): Promise<DoctorReviewsResponse> => {
  const response = await client.get<DoctorReviewsResponse>('/doctors/me/reviews')
  return response.data
}

export const getMyDoctorApplication = async (): Promise<DoctorApplication> => {
  const response = await client.get<DoctorApplication>('/doctors/me/application')
  return response.data
}

export const getDoctorApplications = async (reviewStatus?: DoctorApplicationStatusPayload['status']): Promise<DoctorApplicationListResponse> => {
  const response = await client.get<DoctorApplicationListResponse>('/doctors/applications', {
    params: reviewStatus ? { review_status: reviewStatus } : {},
  })
  return response.data
}

export const updateDoctorApplicationStatus = async (
  doctorId: number,
  payload: DoctorApplicationStatusPayload
): Promise<DoctorApplication> => {
  const response = await client.post<DoctorApplication>(`/doctors/applications/${doctorId}/status`, payload)
  return response.data
}

export const updateMyDoctorProfile = async (payload: DoctorProfileUpsertPayload): Promise<DoctorCard> => {
  const response = await client.put<DoctorCard>('/doctors/me/profile', payload)
  return response.data
}

/** Sube (o reemplaza) la foto de perfil del médico. */
export const uploadMyDoctorPhoto = async (file: File): Promise<{ photo_url: string | null }> => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await client.post<{ photo_url: string | null }>('/doctors/me/photo', formData)
  return response.data
}

/** Elimina la foto de perfil del médico. */
export const deleteMyDoctorPhoto = async (): Promise<void> => {
  await client.delete('/doctors/me/photo')
}

export const getMyDoctorVideoSessions = async (): Promise<DoctorVideoSessionListResponse> => {
  const response = await client.get<DoctorVideoSessionListResponse>('/doctors/me/video-sessions')
  return response.data
}

export const getDoctorPatientTimeline = async (patientId: number): Promise<DoctorPatientTimeline> => {
  const response = await client.get<DoctorPatientTimeline>(`/doctors/patients/${patientId}/timeline`)
  return response.data
}

export interface DoctorPatientSummary {
  patient_id: number
  email: string
  full_name: string | null
  appointments_count: number
  completed_appointments: number
  upcoming_appointments: number
  video_sessions_count: number
  last_activity_at: string | null
  last_review_rating: number | null
}

export interface DoctorPatientListResponse {
  patients: DoctorPatientSummary[]
  total: number
}

export const getMyPatients = async (): Promise<DoctorPatientListResponse> => {
  const response = await client.get<DoctorPatientListResponse>('/doctors/me/patients')
  return response.data
}

/** Propone cambios en los datos del paciente. El paciente debe aprobarlos. */
export const proposePatientProfileChanges = async (
  patientId: number,
  payload: PatientProfilePayload & { doctor_message?: string | null },
): Promise<PatientProfileChangeRequest> => {
  const response = await client.post<PatientProfileChangeRequest>(
    `/doctors/patients/${patientId}/profile-change-requests`,
    payload,
  )
  return response.data
}

/** Propuestas de cambio enviadas por este médico a un paciente. */
export const getPatientProfileChangeRequests = async (
  patientId: number,
): Promise<PatientProfileChangeRequest[]> => {
  const response = await client.get<PatientProfileChangeRequest[]>(
    `/doctors/patients/${patientId}/profile-change-requests`,
  )
  return response.data
}
