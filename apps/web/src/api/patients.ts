import client from './client'

export type PatientSex = 'male' | 'female' | 'other'

export interface PatientProfile {
  id: number | null
  user_id: number
  email: string
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null
  sex: PatientSex | null
  phone: string | null
  country: string | null
  city: string | null
  timezone: string | null
  blood_type: string | null
  allergies: string | null
  chronic_conditions: string | null
  current_medications: string | null
  family_history: string | null
  height_cm: number | null
  weight_kg: number | null
  smoker: boolean | null
  alcohol: boolean | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  notes: string | null
  full_name: string | null
  age: number | null
  created_at: string | null
  updated_at: string | null
}

export type PatientProfilePayload = Partial<
  Omit<PatientProfile, 'id' | 'user_id' | 'email' | 'full_name' | 'age' | 'created_at' | 'updated_at'>
>

export const getMyPatientProfile = async (): Promise<PatientProfile> => {
  const response = await client.get<PatientProfile>('/patients/me/profile')
  return response.data
}

export const updateMyPatientProfile = async (payload: PatientProfilePayload): Promise<PatientProfile> => {
  const response = await client.put<PatientProfile>('/patients/me/profile', payload)
  return response.data
}

export const getPatientProfile = async (patientId: number): Promise<PatientProfile> => {
  const response = await client.get<PatientProfile>(`/doctors/patients/${patientId}/profile`)
  return response.data
}

export interface PatientProfileChangeDiff {
  from: unknown
  to: unknown
}

export interface PatientProfileChangeRequest {
  id: number
  patient_id: number
  patient_email: string | null
  patient_name: string | null
  doctor_id: number | null
  doctor_name: string | null
  status: 'pending' | 'approved' | 'rejected'
  proposed_changes: Record<string, PatientProfileChangeDiff>
  current_snapshot: Record<string, unknown>
  doctor_message: string | null
  patient_note: string | null
  created_at: string | null
  resolved_at: string | null
}

/** Solicitudes de cambio que un médico propuso al paciente autenticado. */
export const getMyPatientProfileChangeRequests = async (): Promise<PatientProfileChangeRequest[]> => {
  const response = await client.get<PatientProfileChangeRequest[]>('/patients/me/profile-change-requests')
  return response.data
}

export const resolvePatientProfileChangeRequest = async (
  requestId: number,
  action: 'approve' | 'reject',
  patientNote?: string | null,
): Promise<PatientProfileChangeRequest> => {
  const response = await client.post<PatientProfileChangeRequest>(
    `/patients/me/profile-change-requests/${requestId}/resolve`,
    { action, patient_note: patientNote ?? null },
  )
  return response.data
}
