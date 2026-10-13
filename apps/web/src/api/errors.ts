import client from './client'

export interface ErrorLogItem {
  id: number
  created_at: string | null
  level: 'error' | 'warning' | 'info' | string
  source: 'backend' | 'client' | string
  status_code: number | null
  method: string | null
  path: string | null
  error_type: string | null
  message: string
  user_id: number | null
  user_email: string | null
  user_role: string | null
  request_id: string | null
  video_session_id: number | null
  appointment_id: number | null
  consultation_id: number | null
  fingerprint: string | null
  occurrences: number
}

export interface ErrorLogDetail extends ErrorLogItem {
  stack_trace: string | null
  context: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
}

export interface ErrorLogSummary {
  total: number
  last_24h: number
  video_total: number
  client_total: number
  backend_total: number
}

export interface ErrorLogListResponse {
  items: ErrorLogItem[]
  total: number
  limit: number
  offset: number
  summary: ErrorLogSummary
}

export interface ErrorLogQuery {
  level?: string
  source?: string
  status_code?: number
  path?: string
  user_id?: number
  video_only?: boolean
  search?: string
  start?: string
  end?: string
  limit?: number
  offset?: number
}

export const getErrorLogs = async (params: ErrorLogQuery = {}): Promise<ErrorLogListResponse> => {
  const response = await client.get<ErrorLogListResponse>('/admin/error-logs', { params })
  return response.data
}

export const getErrorLog = async (errorId: number): Promise<ErrorLogDetail> => {
  const response = await client.get<ErrorLogDetail>(`/admin/error-logs/${errorId}`)
  return response.data
}

export const deleteErrorLog = async (errorId: number): Promise<void> => {
  await client.delete(`/admin/error-logs/${errorId}`)
}

export const deleteErrorLogs = async (ids: number[]): Promise<{ deleted: number }> => {
  const response = await client.post<{ deleted: number }>('/admin/error-logs/bulk-delete', { ids })
  return response.data
}

export const cleanupErrorLogs = async (days?: number): Promise<{ deleted: number; retention_days: number }> => {
  const response = await client.post<{ deleted: number; retention_days: number }>(
    '/admin/error-logs/cleanup',
    {},
    { params: days ? { days } : {} },
  )
  return response.data
}
