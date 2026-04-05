import client from './client'
import type { ConsultationStructuredIntake } from './consultations'

export type DoctorPresenceStatus = 'offline' | 'online' | 'busy'

export interface DoctorPresence {
  status: DoctorPresenceStatus
  status_message: string | null
  last_seen_at: string
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
  presence: DoctorPresence
}

export interface DoctorListResponse {
  doctors: DoctorCard[]
  total: number
}

export interface DoctorVideoSession {
  video_session_id: number
  consultation_id: number | null
  appointment_id?: number | null
  patient_id: number
  status: 'prepared' | 'active' | 'completed' | 'cancelled' | 'expired' | 'failed'
  provider: 'daily' | 'mock_daily'
  room_name: string
  room_url: string | null
  doctor_token: string
  doctor_price_per_min_cents: number
  estimated_minutes: number
  prepaid_amount_cents: number
  expires_at: string
  created_at: string
  patient_email: string
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
  country: string | null
  city: string | null
  timezone: string | null
  government_id: string | null
  years_experience: number | null
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
  country: string
  city: string
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
  item_type: 'consultation' | 'appointment'
  sort_at: string
  specialty_id: number
  specialty_name: string
  consultation_id: number | null
  appointment_id: number | null
  consultation_status: 'created' | 'active' | 'closed' | null
  appointment_status: 'scheduled' | 'completed' | 'cancelled' | 'no_show' | null
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
}

export interface DoctorPatientTimeline {
  patient_id: number
  patient_email: string
  doctor_id: number
  can_view_history: boolean
  items: DoctorPatientTimelineItem[]
  total: number
}

export const getDoctorsBySpecialty = async (slug: string): Promise<DoctorListResponse> => {
  const response = await client.get<DoctorListResponse>(`/doctors/specialty/${slug}`)
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

export const getMyDoctorVideoSessions = async (): Promise<DoctorVideoSessionListResponse> => {
  const response = await client.get<DoctorVideoSessionListResponse>('/doctors/me/video-sessions')
  return response.data
}

export const getDoctorPatientTimeline = async (patientId: number): Promise<DoctorPatientTimeline> => {
  const response = await client.get<DoctorPatientTimeline>(`/doctors/patients/${patientId}/timeline`)
  return response.data
}
