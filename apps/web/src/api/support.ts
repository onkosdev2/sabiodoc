import client from './client'

export type SupportTicketCategory = 'account' | 'payments' | 'video' | 'app_error' | 'other'
export type SupportTicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'
export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type SupportTicketAuthorRole = 'user' | 'support' | 'system'

export interface SupportAttachment {
  id: number
  original_name: string
  content_type: string | null
  bytes: number
  url: string
  secure_url: string
}

export interface SupportTicketMessage {
  id: number
  author_role: SupportTicketAuthorRole
  author_user_id: number | null
  author_name: string | null
  body: string
  attachments: SupportAttachment[]
  created_at: string | null
}

export interface SupportTicket {
  id: number
  reference: string | null
  subject: string
  category: SupportTicketCategory
  status: SupportTicketStatus
  priority: SupportTicketPriority
  user_id: number | null
  user_email: string | null
  user_name: string | null
  message_count: number
  last_message_preview: string | null
  created_at: string | null
  updated_at: string | null
  closed_at: string | null
}

export interface SupportTicketDetail extends SupportTicket {
  messages: SupportTicketMessage[]
  context: Record<string, unknown> | null
  related_appointment_id: number | null
  related_video_session_id: number | null
  assigned_to_user_id: number | null
  assigned_to_email: string | null
}

export interface SupportTicketListResponse {
  tickets: SupportTicket[]
  total: number
  open_count: number
}

export interface SupportTicketCreatePayload {
  subject: string
  category: SupportTicketCategory
  message: string
  attachment_ids?: number[]
  context?: {
    url?: string
    user_agent?: string
    appointment_id?: number
    video_session_id?: number
  }
}

export interface SupportTicketReplyPayload {
  message: string
  attachment_ids?: number[]
}

export interface SupportInboxQuery {
  status_filter?: SupportTicketStatus
  category?: SupportTicketCategory
  priority?: SupportTicketPriority
  search?: string
}

export const uploadSupportAttachment = async (file: File): Promise<SupportAttachment> => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await client.post<SupportAttachment>('/support/attachments', formData)
  return response.data
}

export const createSupportTicket = async (
  payload: SupportTicketCreatePayload,
): Promise<SupportTicketDetail> => {
  const response = await client.post<SupportTicketDetail>('/support/tickets', payload)
  return response.data
}

export const getMySupportTickets = async (): Promise<SupportTicketListResponse> => {
  const response = await client.get<SupportTicketListResponse>('/support/tickets')
  return response.data
}

export const getSupportTicket = async (ticketId: number): Promise<SupportTicketDetail> => {
  const response = await client.get<SupportTicketDetail>(`/support/tickets/${ticketId}`)
  return response.data
}

export const replySupportTicket = async (
  ticketId: number,
  payload: SupportTicketReplyPayload,
): Promise<SupportTicketMessage> => {
  const response = await client.post<SupportTicketMessage>(
    `/support/tickets/${ticketId}/messages`,
    payload,
  )
  return response.data
}

export const getSupportInbox = async (
  params: SupportInboxQuery = {},
): Promise<SupportTicketListResponse> => {
  const response = await client.get<SupportTicketListResponse>('/support/inbox', { params })
  return response.data
}

export const updateSupportTicket = async (
  ticketId: number,
  payload: { status?: SupportTicketStatus; priority?: SupportTicketPriority; assigned_to_user_id?: number },
): Promise<SupportTicketDetail> => {
  const response = await client.patch<SupportTicketDetail>(`/support/inbox/${ticketId}`, payload)
  return response.data
}
