import client from './client'

export interface TriageRequest {
  symptoms_text: string
  age?: number
  sex?: string
}

export interface AlternativeSpecialty {
  specialty_slug: string
  reason: string
}

export interface TriageResult {
  urgency: 'low' | 'medium' | 'high' | 'emergency'
  recommended_specialty_slug: string
  rationale_bullets: string[]
  clarifying_questions: string[]
  alternatives: AlternativeSpecialty[]
  red_flags_detected: string[]
  disclaimer: string
}

export interface TriageResponse {
  id: number
  result: TriageResult
  created_at: string
}

export const submitTriage = async (data: TriageRequest): Promise<TriageResponse> => {
  const response = await client.post<TriageResponse>('/ai/triage', data)
  return response.data
}
