import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import DoctorEarnings from './DoctorEarnings'
import {
  getMyEarnings,
  listMyEarnings,
  listMyPayouts,
  requestPayout,
} from '../api/earnings'

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  dismiss: vi.fn(),
}))

vi.mock('../api/earnings', () => ({
  getMyEarnings: vi.fn(),
  listMyEarnings: vi.fn(),
  listMyPayouts: vi.fn(),
  requestPayout: vi.fn(),
}))
vi.mock('../context/ToastContext', () => ({ useToast: () => toast }))

const mockedSummary = vi.mocked(getMyEarnings)
const mockedEarnings = vi.mocked(listMyEarnings)
const mockedPayouts = vi.mocked(listMyPayouts)
const mockedRequest = vi.mocked(requestPayout)

describe('DoctorEarnings', () => {
  beforeEach(() => {
    mockedSummary.mockReset()
    mockedEarnings.mockReset()
    mockedPayouts.mockReset()
    mockedRequest.mockReset()
    mockedSummary.mockResolvedValue({
      pending_cents: 500,
      available_cents: 2400,
      paid_cents: 1000,
      currency: 'USD',
    })
    mockedEarnings.mockResolvedValue([
      {
        id: 1,
        appointment_id: 9,
        gross_cents: 3000,
        platform_fee_cents: 600,
        net_cents: 2400,
        status: 'available',
        available_at: '2026-10-21T10:00:00Z',
        created_at: '2026-10-21T10:00:00Z',
      },
    ])
    mockedPayouts.mockResolvedValue([])
    mockedRequest.mockResolvedValue({
      id: 1,
      amount_cents: 2400,
      currency: 'USD',
      provider: 'mock',
      provider_reference: 'mock_po_1',
      status: 'paid',
      failure_reason: null,
      requested_at: '2026-10-21T10:00:00Z',
      processed_at: '2026-10-21T10:00:00Z',
    })
  })

  it('muestra el resumen y solicita el payout', async () => {
    render(<DoctorEarnings />)

    expect(await screen.findByText(/Cita #9/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Solicitar payout' }))

    await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(1))
    expect(toast.success).toHaveBeenCalled()
  })
})
