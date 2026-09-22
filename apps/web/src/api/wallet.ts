import client from './client'

export type WalletTransactionType =
  | 'topup'
  | 'withdrawal'
  | 'consultation_payment'
  | 'consultation_income'
  | 'refund'
  | 'adjustment'

export type WalletTransactionStatus = 'completed' | 'pending' | 'reversed'
export type WithdrawalStatus = 'pending' | 'paid' | 'rejected'

export interface WalletTransaction {
  id: number
  type: WalletTransactionType
  status: WalletTransactionStatus
  amount_cents: number
  balance_after_cents: number
  description: string
  reference_type: string | null
  reference_id: number | null
  created_at: string
}

export interface Wallet {
  balance_cents: number
  credits: number
  currency: string
  min_topup_cents: number
  min_withdrawal_cents: number
  transactions: WalletTransaction[]
}

export interface Withdrawal {
  id: number
  user_id: number
  user_email?: string | null
  amount_cents: number
  status: WithdrawalStatus
  destination: string
  admin_notes: string | null
  requested_at: string | null
  processed_at: string | null
  created_at: string | null
}

export interface WithdrawalListResponse {
  withdrawals: Withdrawal[]
  total: number
}

export const getMyWallet = async (limit = 20): Promise<Wallet> => {
  const response = await client.get<Wallet>('/wallet/me', { params: { limit } })
  return response.data
}

export const topupCredits = async (amountCents: number): Promise<Wallet> => {
  const response = await client.post<Wallet>('/wallet/topup', { amount_cents: amountCents })
  return response.data
}

export const requestWithdrawal = async (
  amountCents: number,
  destination: string,
): Promise<Withdrawal> => {
  const response = await client.post<Withdrawal>('/wallet/withdraw', {
    amount_cents: amountCents,
    destination,
  })
  return response.data
}

export const getMyWithdrawals = async (): Promise<WithdrawalListResponse> => {
  const response = await client.get<WithdrawalListResponse>('/wallet/me/withdrawals')
  return response.data
}

export const getAdminWithdrawals = async (status?: WithdrawalStatus): Promise<WithdrawalListResponse> => {
  const response = await client.get<WithdrawalListResponse>('/admin/withdrawals', {
    params: status ? { status_filter: status } : {},
  })
  return response.data
}

export const processWithdrawal = async (
  withdrawalId: number,
  approve: boolean,
  notes?: string,
): Promise<Withdrawal> => {
  const response = await client.post<Withdrawal>(`/admin/withdrawals/${withdrawalId}/process`, {
    approve,
    notes: notes?.trim() || undefined,
  })
  return response.data
}
