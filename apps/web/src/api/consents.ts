import client from './client'

export type ConsentType =
  | 'terms'
  | 'privacy'
  | 'clinical_data'
  | 'telemedicine'
  | 'transcription'
  | 'recording'
  | 'marketing'

export interface ConsentRecord {
  id: number
  appointment_id: number | null
  consent_type: ConsentType
  version: string
  accepted_at: string
  revoked_at: string | null
}

export const getMyConsents = async (): Promise<ConsentRecord[]> => {
  const response = await client.get<ConsentRecord[]>('/consents/me')
  return response.data
}

export const revokeConsent = async (
  consentType: ConsentType,
  appointmentId?: number | null,
): Promise<{ revoked: number }> => {
  const response = await client.post<{ revoked: number }>('/consents/revoke', {
    consent_type: consentType,
    appointment_id: appointmentId ?? undefined,
  })
  return response.data
}
