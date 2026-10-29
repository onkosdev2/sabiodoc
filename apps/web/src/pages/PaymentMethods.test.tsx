import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import PaymentMethods from './PaymentMethods'
import {
  addPaymentMethod,
  createSetupIntent,
  getPaymentConfig,
  listPaymentMethods,
} from '../api/payments'

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  dismiss: vi.fn(),
}))

vi.mock('../api/payments', () => ({
  getPaymentConfig: vi.fn(),
  createSetupIntent: vi.fn(),
  listPaymentMethods: vi.fn(),
  addPaymentMethod: vi.fn(),
  setDefaultPaymentMethod: vi.fn(),
  deletePaymentMethod: vi.fn(),
}))
vi.mock('../context/ToastContext', () => ({ useToast: () => toast }))

const mockedConfig = vi.mocked(getPaymentConfig)
const mockedMethods = vi.mocked(listPaymentMethods)
const mockedSetup = vi.mocked(createSetupIntent)
const mockedAdd = vi.mocked(addPaymentMethod)

const METHOD = {
  id: 1,
  brand: 'Visa',
  last4: '4242',
  exp_month: 12,
  exp_year: 2030,
  is_default: true,
  status: 'active',
  created_at: '2026-10-21T10:00:00Z',
}

describe('PaymentMethods', () => {
  beforeEach(() => {
    mockedConfig.mockReset()
    mockedMethods.mockReset()
    mockedSetup.mockReset()
    mockedAdd.mockReset()
    mockedConfig.mockResolvedValue({
      provider: 'mock',
      configured: true,
      currency: 'USD',
      mock_tokens: ['pm_mock_success'],
    })
    mockedMethods.mockResolvedValue([METHOD])
    mockedSetup.mockResolvedValue({
      provider: 'mock',
      client_secret: 'mock_setup_1',
      status: 'requires_confirmation',
    })
    mockedAdd.mockResolvedValue(METHOD)
  })

  it('lista la tarjeta guardada y su estado predeterminado', async () => {
    render(<PaymentMethods />)

    expect((await screen.findAllByText(/Visa •••• 4242/)).length).toBeGreaterThan(0)
    expect(screen.getByText('Predeterminada')).toBeInTheDocument()
  })

  it('agrega una tarjeta mock', async () => {
    render(<PaymentMethods />)
    await screen.findAllByText(/Visa •••• 4242/)

    await userEvent.click(screen.getByRole('button', { name: 'Agregar tarjeta' }))

    await waitFor(() => expect(mockedSetup).toHaveBeenCalledTimes(1))
    expect(mockedAdd).toHaveBeenCalledWith('pm_mock_success')
    expect(toast.success).toHaveBeenCalled()
  })
})
