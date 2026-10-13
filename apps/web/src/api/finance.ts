import client from './client'

export interface FinancePolicy {
  platform_fee_bps: number
  platform_fee_percent: number
  min_price_cents: number
  max_price_cents: number
  currency: string
  is_mock_money: boolean
}

export interface FinanceOverview {
  start: string | null
  end: string | null
  currency: string
  platform_fee_bps: number
  platform_fee_percent: number
  is_mock_money: boolean
  gmv_cents: number
  platform_revenue_cents: number
  doctor_payouts_cents: number
  completed_count: number
  topups_cents: number
  refunds_cents: number
  withdrawals_paid_cents: number
  withdrawals_processing_cents: number
  withdrawals_failed_cents: number
  held_cents: number
  user_balances_cents: number
  doctor_balances_cents: number
}

export type FinanceMovementType =
  | 'topup'
  | 'withdrawal'
  | 'consultation_payment'
  | 'consultation_income'
  | 'refund'
  | 'adjustment'

export interface FinanceMovement {
  id: number
  created_at: string | null
  type: FinanceMovementType | string
  direction: 'in' | 'out'
  amount_cents: number
  status: string
  description: string
  actor_email: string | null
  actor_role: string | null
  reference_type: string | null
  reference_id: number | null
}

export interface FinanceMovementListResponse {
  items: FinanceMovement[]
  total: number
  limit: number
  offset: number
  inflow_cents: number
  outflow_cents: number
}

export interface CommissionItem {
  appointment_payment_id: number
  appointment_id: number
  released_at: string | null
  doctor_profile_id: number
  doctor_name: string
  doctor_email: string | null
  patient_email: string | null
  billable_seconds: number
  gross_cents: number
  fee_cents: number
  net_cents: number
}

export interface CommissionListResponse {
  items: CommissionItem[]
  total: number
  limit: number
  offset: number
  gross_cents: number
  fee_cents: number
  net_cents: number
  platform_fee_percent: number
}

export interface FinanceDateRange {
  start?: string
  end?: string
}

export const getFinancePolicy = async (): Promise<FinancePolicy> => {
  const response = await client.get<FinancePolicy>('/finance/policy')
  return response.data
}

export const getFinanceOverview = async (params: FinanceDateRange = {}): Promise<FinanceOverview> => {
  const response = await client.get<FinanceOverview>('/admin/finance/overview', { params })
  return response.data
}

export const getFinanceMovements = async (
  params: FinanceDateRange & { type?: string; search?: string; limit?: number; offset?: number } = {},
): Promise<FinanceMovementListResponse> => {
  const response = await client.get<FinanceMovementListResponse>('/admin/finance/transactions', {
    params,
  })
  return response.data
}

export const getPlatformCommissions = async (
  params: FinanceDateRange & { limit?: number; offset?: number } = {},
): Promise<CommissionListResponse> => {
  const response = await client.get<CommissionListResponse>('/admin/finance/commissions', {
    params,
  })
  return response.data
}
