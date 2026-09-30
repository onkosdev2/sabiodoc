import client from './client'

export interface User {
  id: number
  email: string
  role: 'patient' | 'doctor' | 'reviewer' | 'admin'
  doctor_status?: 'pending' | 'approved' | 'rejected' | 'suspended' | null
  is_reviewer?: boolean
  is_email_verified?: boolean
  display_name?: string | null
  doctor_display_name?: string | null
  patient_display_name?: string | null
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

/** Respuesta de registro: si exige verificación, no trae token ni usuario. */
export interface RegisterResponse {
  message: string
  verification_required: boolean
  access_token?: string | null
  token_type?: string
  user?: User | null
}

export const register = async (email: string, password: string): Promise<RegisterResponse> => {
  const response = await client.post<RegisterResponse>('/auth/register', { email, password })
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

export const registerDoctor = async (payload: DoctorRegistrationPayload): Promise<RegisterResponse> => {
  const response = await client.post<RegisterResponse>('/auth/register/doctor', payload)
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

export interface MessageResponse {
  message: string
}

export const forgotPassword = async (email: string): Promise<MessageResponse> => {
  const response = await client.post<MessageResponse>('/auth/forgot-password', { email })
  return response.data
}

export const resetPassword = async (token: string, newPassword: string): Promise<MessageResponse> => {
  const response = await client.post<MessageResponse>('/auth/reset-password', {
    token,
    new_password: newPassword,
  })
  return response.data
}

/** Confirma el correo con el token enviado al registrarse. */
export const verifyEmail = async (token: string): Promise<MessageResponse> => {
  const response = await client.post<MessageResponse>('/auth/verify-email', { token })
  return response.data
}

/** Reenvía el enlace de verificación de correo. */
export const resendVerification = async (email: string): Promise<MessageResponse> => {
  const response = await client.post<MessageResponse>('/auth/resend-verification', { email })
  return response.data
}