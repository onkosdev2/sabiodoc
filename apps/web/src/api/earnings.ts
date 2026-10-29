import client from './client'

export interface EarningsSummary {
  pending_cents: number
  available_cents: number
  paid_cents: number
  currency: string
}

export interface EarningItem {
  id: number
  appointment_id: number
  gross_cents: number
  platform_fee_cents: number
  net_cents: number
  status: 'pending' | 'available' | 'paid' | 'reversed'
  available_at: string | null
  created_at: string
}

export interface PayoutItem {
  id: number
  amount_cents: number
  currency: string
  provider: string
  provider_reference: string | null
  status: 'pending' | 'processing' | 'paid' | 'failed'
  failure_reason: string | null
  requested_at: string
  processed_at: string | null
}

export const getMyEarnings = async (): Promise<EarningsSummary> => {
  const response = await client.get<EarningsSummary>('/earnings/me')
  return response.data
}

export const listMyEarnings = async (): Promise<EarningItem[]> => {
  const response = await client.get<EarningItem[]>('/earnings/me/items')
  return response.data
}

export const listMyPayouts = async (): Promise<PayoutItem[]> => {
  const response = await client.get<PayoutItem[]>('/earnings/me/payouts')
  return response.data
}

export const requestPayout = async (amountCents?: number): Promise<PayoutItem> => {
  const response = await client.post<PayoutItem>('/earnings/me/payouts', {
    amount_cents: amountCents,
  })
  return response.data
}

export const getAdminPayouts = async (): Promise<PayoutItem[]> => {
  const response = await client.get<PayoutItem[]>('/earnings/admin/payouts')
  return response.data
}

export const retryAdminPayout = async (payoutId: number): Promise<PayoutItem> => {
  const response = await client.post<PayoutItem>(`/earnings/admin/payouts/${payoutId}/retry`)
  return response.data
}
