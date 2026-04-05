import client from './client'
import { Specialty } from './specialties'

export interface Favorite {
  id: number
  specialty_id: number | null
  created_at: string
  specialty: Specialty | null
}

export interface FavoriteListResponse {
  favorites: Favorite[]
  total: number
}

export const addFavorite = async (specialty_id: number): Promise<Favorite> => {
  const response = await client.post<Favorite>('/favorites', { specialty_id, action: 'add' })
  return response.data
}

export const removeFavorite = async (specialty_id: number): Promise<void> => {
  await client.delete(`/favorites/${specialty_id}`)
}

export const getMyFavorites = async (): Promise<FavoriteListResponse> => {
  const response = await client.get<FavoriteListResponse>('/favorites/my')
  return response.data
}
