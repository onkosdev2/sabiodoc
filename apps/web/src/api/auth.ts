import client from './client'

export interface User {
  id: number
  email: string
  role: 'patient' | 'doctor' | 'admin'
  doctor_status?: 'pending' | 'approved' | 'rejected' | 'suspended' | null
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export const register = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await client.post<AuthResponse>('/auth/register', { email, password })
  return response.data
}

export interface DoctorRegistrationPayload {
  email: string
  password: string
  display_name: string
  professional_title: string
  bio_short?: string
  price_per_min_cents: number
  license_number: string
  license_country: string
  country: string
  city: string
  timezone: string
  government_id: string
  years_experience: number
  specialty_ids: number[]
}

export const registerDoctor = async (payload: DoctorRegistrationPayload): Promise<AuthResponse> => {
  const response = await client.post<AuthResponse>('/auth/register/doctor', payload)
  return response.data
}

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await client.post<AuthResponse>('/auth/login', { email, password })
  return response.data
}

export const getMe = async (): Promise<User> => {
  const response = await client.get<User>('/auth/me')
  return response.data
}
