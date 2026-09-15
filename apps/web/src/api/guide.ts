import client from './client'

export interface GuideOption {
  value: string
  label: string
}

export interface GuideAlternative {
  specialty_slug: string
  reason: string
}

export interface GuideHistoryItem {
  question_id: string
  question: string
  answer: string
  answer_label: string
}

export interface GuideStepResponse {
  status: 'question' | 'recommendation'
  step: number
  max_steps: number
  // status === 'question'
  question_id?: string
  question?: string
  options: GuideOption[]
  // status === 'recommendation'
  recommended_specialty_slug?: string
  recommended_specialty_name?: string
  confidence?: string
  reason?: string
  rationale_bullets: string[]
  clarifying_questions: string[]
  alternatives: GuideAlternative[]
  urgency: 'low' | 'medium' | 'high' | 'emergency'
  red_flags_detected: string[]
  disclaimer: string
}

/**
 * Envía el historial de respuestas a la IA y obtiene la siguiente pregunta
 * (con sus opciones) o bien la recomendación final de especialidad.
 */
export const submitGuideStep = async (
  history: GuideHistoryItem[]
): Promise<GuideStepResponse> => {
  const response = await client.post<GuideStepResponse>('/guide/step', { history })
  return response.data
}
