import client from './client'
import type { ConsultationStructuredIntake } from './consultations'

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface AvailabilitySlotInput {
  weekday: number
  start_time: string
  end_time: string
  is_active: boolean
}

export interface AvailabilitySlot extends AvailabilitySlotInput {
  id: number
}

export interface DoctorAvailability {
  timezone: string
  slots: AvailabilitySlot[]
}

export interface BookableSlot {
  starts_at: string
  ends_at: string
  duration_minutes: number
}

export interface BookableSlotListResponse {
  timezone: string
  slots: BookableSlot[]
  total: number
}

export interface Appointment {
  id: number
  consultation_id: number | null
  specialty_id: number
  specialty_name: string
  patient_id: number
  patient_email: string
  doctor_id: number
  doctor_name: string
  status: AppointmentStatus
  scheduled_at: string
  duration_minutes: number
  patient_note: string | null
  ai_summary_snapshot: string | null
  ai_intake_snapshot: ConsultationStructuredIntake | null
  doctor_note: string | null
  followup_instructions: string | null
  cancellation_reason: string | null
  booked_via_ai: boolean
  consent_text_version: string | null
  joined_patient_at: string | null
  joined_doctor_at: string | null
  no_show_marked_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  review_rating: number | null
  review_comment: string | null
}

export interface AppointmentListResponse {
  appointments: Appointment[]
  total: number
}

export interface DoctorDashboardMetricCard {
  key: string
  label: string
  value: string
}

export interface DoctorDashboardResponse {
  metrics: DoctorDashboardMetricCard[]
  upcoming_appointments: Appointment[]
  recent_completed_appointments: Appointment[]
  active_video_sessions: {
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
  }[]
  unread_notifications: number
  average_rating: number
}

export interface AppointmentVideoSession {
  video_session_id: number
  appointment_id: number
  consultation_id: number | null
  status: 'prepared' | 'active' | 'completed' | 'cancelled' | 'expired' | 'failed'
  provider: 'daily' | 'mock_daily'
  room_name: string
  room_url: string | null
  participant_token: string
  participant_role: 'patient' | 'doctor'
  specialty_name: string
  doctor_name: string
  expires_at: string
}

export interface AppointmentCreatePayload {
  doctor_id: number
  scheduled_at: string
  duration_minutes: number
  consultation_id?: number
  specialty_id?: number
  patient_note?: string
  accepted_terms: boolean
  consent_text_version?: string
}

export interface AppointmentCompletePayload {
  doctor_note?: string
  followup_instructions?: string
}

export interface AppointmentCancelPayload {
  reason?: string
}

export interface AppointmentReschedulePayload {
  scheduled_at: string
  duration_minutes: number
  reason?: string
}

export interface AppointmentNoShowPayload {
  reason?: string
}

export interface AppointmentReviewPayload {
  rating: number
  comment?: string
}

export const getDoctorAvailability = async (): Promise<DoctorAvailability> => {
  const response = await client.get<DoctorAvailability>('/doctors/me/availability')
  return response.data
}

export const updateDoctorAvailability = async (payload: { timezone: string; slots: AvailabilitySlotInput[] }): Promise<DoctorAvailability> => {
  const response = await client.put<DoctorAvailability>('/doctors/me/availability', payload)
  return response.data
}

export const getDoctorBookableSlots = async (
  doctorId: number,
  days = 14,
  durationMinutes = 30
): Promise<BookableSlotListResponse> => {
  const response = await client.get<BookableSlotListResponse>(`/doctors/${doctorId}/bookable-slots`, {
    params: { days, duration_minutes: durationMinutes },
  })
  return response.data
}

export const createAppointment = async (payload: AppointmentCreatePayload): Promise<Appointment> => {
  const response = await client.post<Appointment>('/appointments', payload)
  return response.data
}

export const getMyAppointments = async (status?: AppointmentStatus): Promise<AppointmentListResponse> => {
  const response = await client.get<AppointmentListResponse>('/appointments/my', {
    params: status ? { status_filter: status } : {},
  })
  return response.data
}

export const getMyDoctorAppointments = async (status?: AppointmentStatus): Promise<AppointmentListResponse> => {
  const response = await client.get<AppointmentListResponse>('/appointments/doctor/my', {
    params: status ? { status_filter: status } : {},
  })
  return response.data
}

export const getAppointment = async (appointmentId: number): Promise<Appointment> => {
  const response = await client.get<Appointment>(`/appointments/${appointmentId}`)
  return response.data
}

export const cancelAppointment = async (appointmentId: number): Promise<Appointment> => {
  const response = await client.post<Appointment>(`/appointments/${appointmentId}/cancel`, {})
  return response.data
}

export const cancelAppointmentWithReason = async (appointmentId: number, payload: AppointmentCancelPayload): Promise<Appointment> => {
  const response = await client.post<Appointment>(`/appointments/${appointmentId}/cancel`, payload)
  return response.data
}

export const rescheduleAppointment = async (appointmentId: number, payload: AppointmentReschedulePayload): Promise<Appointment> => {
  const response = await client.post<Appointment>(`/appointments/${appointmentId}/reschedule`, payload)
  return response.data
}

export const markAppointmentNoShow = async (appointmentId: number, payload: AppointmentNoShowPayload): Promise<Appointment> => {
  const response = await client.post<Appointment>(`/appointments/${appointmentId}/mark-no-show`, payload)
  return response.data
}

export const completeAppointment = async (appointmentId: number, payload: AppointmentCompletePayload): Promise<Appointment> => {
  const response = await client.post<Appointment>(`/appointments/${appointmentId}/complete`, payload)
  return response.data
}

export const reviewAppointment = async (appointmentId: number, payload: AppointmentReviewPayload): Promise<Appointment> => {
  const response = await client.post<Appointment>(`/appointments/${appointmentId}/review`, payload)
  return response.data
}

export const prepareAppointmentVideoSession = async (appointmentId: number): Promise<AppointmentVideoSession> => {
  const response = await client.post<AppointmentVideoSession>(`/appointments/${appointmentId}/video-session/prepare`)
  return response.data
}

export const getDoctorDashboard = async (): Promise<DoctorDashboardResponse> => {
  const response = await client.get<DoctorDashboardResponse>('/doctors/me/dashboard')
  return response.data
}
