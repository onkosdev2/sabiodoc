import client from './client'
import type { DoctorCard } from './doctors'

export interface Favorite {
  id: number
  doctor_id: number
  created_at: string
  doctor: DoctorCard | null
}

export interface FavoriteListResponse {
  favorites: Favorite[]
  total: number
}

export const addFavorite = async (doctorId: number): Promise<Favorite> => {
  const response = await client.post<Favorite>('/favorites', { doctor_id: doctorId })
  return response.data
}

export const removeFavorite = async (doctorId: number): Promise<void> => {
  await client.delete(`/favorites/${doctorId}`)
}

export const getMyFavorites = async (): Promise<FavoriteListResponse> => {
  const response = await client.get<FavoriteListResponse>('/favorites/my')
  return response.data
}
