import client from './client'

export interface GuideQuestion {
  id: string
  question: string
  options: { value: string; label: string }[]
}

export interface GuideAnswer {
  question_id: string
  answer: string
}

export interface GuideRecommendation {
  recommended_specialty_slug: string
  recommended_specialty_name: string
  confidence: string
  reason: string
  disclaimer: string
}

export const getGuideQuestions = async (): Promise<GuideQuestion[]> => {
  const response = await client.get<GuideQuestion[]>('/guide/questions')
  return response.data
}

export const submitGuideAnswers = async (answers: GuideAnswer[]): Promise<GuideRecommendation> => {
  const response = await client.post<GuideRecommendation>('/guide/recommend', { answers })
  return response.data
}
