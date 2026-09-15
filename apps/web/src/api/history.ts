import client from './client'
import { TriageResult } from './triage'

export type ConsultationSource = 'triage' | 'guide'

export interface ConsultationHistoryItem {
  id: number
  source: ConsultationSource
  result: TriageResult
  created_at: string
  summary?: string
}

export const getConsultationHistory = async (
  limit: number = 30
): Promise<ConsultationHistoryItem[]> => {
  const response = await client.get<ConsultationHistoryItem[]>('/ai/history', {
    params: { limit },
  })
  return response.data
}
