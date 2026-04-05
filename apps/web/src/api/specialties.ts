import client from './client'

export interface Specialty {
  id: number
  slug: string
  name: string
  description: string | null
  keywords: string[]
  is_top: boolean
  created_at: string
}

export interface SpecialtyListResponse {
  specialties: Specialty[]
  total: number
}

export const getSpecialties = async (query?: string): Promise<SpecialtyListResponse> => {
  const params = query ? { query } : {}
  const response = await client.get<SpecialtyListResponse>('/specialties', { params })
  return response.data
}

export const getTopSpecialties = async (): Promise<SpecialtyListResponse> => {
  const response = await client.get<SpecialtyListResponse>('/specialties/top')
  return response.data
}

export const getSpecialtyBySlug = async (slug: string): Promise<Specialty> => {
  const response = await client.get<Specialty>(`/specialties/${slug}`)
  return response.data
}
