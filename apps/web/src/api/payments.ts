import client from './client'

export interface PaymentConfig {
  provider: string
  configured: boolean
  currency: string
  mock_tokens: string[] | null
}

export interface SetupIntentResponse {
  provider: string
  client_secret: string
  status: string
}

export interface PaymentMethod {
  id: number
  brand: string | null
  last4: string | null
  exp_month: number | null
  exp_year: number | null
  is_default: boolean
  status: string
  created_at: string
}

export const getPaymentConfig = async (): Promise<PaymentConfig> => {
  const response = await client.get<PaymentConfig>('/payments/config')
  return response.data
}

export const createSetupIntent = async (): Promise<SetupIntentResponse> => {
  const response = await client.post<SetupIntentResponse>('/payments/setup-intent')
  return response.data
}

export const listPaymentMethods = async (): Promise<PaymentMethod[]> => {
  const response = await client.get<PaymentMethod[]>('/payments/methods')
  return response.data
}

export const addPaymentMethod = async (
  token: string,
  makeDefault = false,
): Promise<PaymentMethod> => {
  const response = await client.post<PaymentMethod>('/payments/methods', {
    token,
    make_default: makeDefault,
  })
  return response.data
}

export const setDefaultPaymentMethod = async (methodId: number): Promise<PaymentMethod> => {
  const response = await client.post<PaymentMethod>(`/payments/methods/${methodId}/default`)
  return response.data
}

export const deletePaymentMethod = async (methodId: number): Promise<void> => {
  await client.delete(`/payments/methods/${methodId}`)
}
