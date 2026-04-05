import client from './client'
import { Specialty } from './specialties'

export interface ConsultationStructuredIntake {
  chief_complaint: string | null
  symptom_summary: string[]
  duration_and_evolution: string | null
  current_medications: string[]
  relevant_history: string[]
  risk_factors: string[]
  red_flags: string[]
  recommended_focus_for_doctor: string[]
  patient_questions_or_goals: string[]
  completeness: 'low' | 'partial' | 'high' | null
}

export interface Consultation {
  id: number
  specialty_id: number
  status: 'created' | 'active' | 'closed'
  room_id: string
  created_at: string
  closed_at: string | null
  summary: string | null
  intake: ConsultationStructuredIntake | null
  specialty: Specialty | null
}

export interface ConsultationListResponse {
  consultations: Consultation[]
  total: number
}

export interface ChatMessage {
  id: number
  consultation_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export interface ChatResponse {
  user_message: ChatMessage
  assistant_message: ChatMessage
}

export interface ChatHistoryResponse {
  messages: ChatMessage[]
  consultation_id: number
  specialty_name: string
}

export interface GenerateSummaryResponse {
  summary: string
  consultation_id: number
  intake: ConsultationStructuredIntake | null
}

export interface VideoSessionPrepareResponse {
  video_session_id: number
  status: 'prepared' | 'active' | 'completed' | 'cancelled' | 'expired' | 'failed'
  provider: 'daily' | 'mock_daily'
  payment_status: 'pending' | 'authorized' | 'captured' | 'failed' | 'waived'
  room_name: string
  room_url: string | null
  patient_token: string
  doctor_token: string
  doctor_price_per_min_cents: number
  estimated_minutes: number
  prepaid_amount_cents: number
  expires_at: string
  payment_reference: string | null
}

export const createConsultation = async (specialty_id: number): Promise<Consultation> => {
  const response = await client.post<Consultation>('/consultations', { specialty_id })
  return response.data
}

export const getMyConsultations = async (): Promise<ConsultationListResponse> => {
  const response = await client.get<ConsultationListResponse>('/consultations/my')
  return response.data
}

export const getConsultation = async (consultationId: number): Promise<Consultation> => {
  const response = await client.get<Consultation>(`/consultations/${consultationId}`)
  return response.data
}

export const startChat = async (consultationId: number): Promise<ChatMessage> => {
  const response = await client.post<ChatMessage>(`/consultations/${consultationId}/start-chat`)
  return response.data
}

export const sendChatMessage = async (consultationId: number, message: string): Promise<ChatResponse> => {
  const response = await client.post<ChatResponse>(`/consultations/${consultationId}/chat`, { message })
  return response.data
}

export const getChatHistory = async (consultationId: number): Promise<ChatHistoryResponse> => {
  const response = await client.get<ChatHistoryResponse>(`/consultations/${consultationId}/messages`)
  return response.data
}

export const generateSummary = async (consultationId: number): Promise<GenerateSummaryResponse> => {
  const response = await client.post<GenerateSummaryResponse>(`/consultations/${consultationId}/generate-summary`)
  return response.data
}

export const prepareVideoSession = async (
  consultationId: number,
  data: { doctor_id: number; estimated_minutes: number; payment_method_id?: string }
): Promise<VideoSessionPrepareResponse> => {
  const response = await client.post<VideoSessionPrepareResponse>(
    `/consultations/${consultationId}/video-session/prepare`,
    data
  )
  return response.data
}
