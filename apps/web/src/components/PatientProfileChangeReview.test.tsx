import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import PatientProfileChangeReview from './PatientProfileChangeReview'
import { resolvePatientProfileChangeRequest, type PatientProfileChangeRequest } from '../api/patients'

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  dismiss: vi.fn(),
}))

vi.mock('../api/patients', () => ({ resolvePatientProfileChangeRequest: vi.fn() }))
vi.mock('../context/ToastContext', () => ({ useToast: () => toast }))

const mockedResolve = vi.mocked(resolvePatientProfileChangeRequest)

function makeRequest(overrides: Partial<PatientProfileChangeRequest> = {}): PatientProfileChangeRequest {
  return {
    id: 1,
    patient_id: 10,
    patient_email: 'ana@example.com',
    patient_name: 'Ana',
    doctor_id: 3,
    doctor_name: 'Dr. López',
    status: 'pending',
    proposed_changes: {
      first_name: { from: 'Ana', to: 'Ana María' },
      allergies: { from: null, to: 'Penicilina' },
    },
    current_snapshot: {},
    doctor_message: 'Corrijo tu nombre',
    patient_note: null,
    created_at: '2026-01-01T10:00:00Z',
    resolved_at: null,
    ...overrides,
  }
}

describe('PatientProfileChangeReview', () => {
  beforeEach(() => {
    mockedResolve.mockReset()
  })

  it('no renderiza nada si no hay propuestas', () => {
    const { container } = render(<PatientProfileChangeReview requests={[]} onResolved={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra el diff propuesto y el mensaje del médico', () => {
    render(<PatientProfileChangeReview requests={[makeRequest()]} onResolved={vi.fn()} />)

    expect(screen.getByText('Propuesta de Dr. López')).toBeInTheDocument()
    expect(screen.getByText('Corrijo tu nombre')).toBeInTheDocument()
    expect(screen.getByText('Nombres')).toBeInTheDocument()
    expect(screen.getByText('Ana María')).toBeInTheDocument()
    expect(screen.getByText('Penicilina')).toBeInTheDocument()
  })

  it('aprueba los cambios y notifica al padre', async () => {
    mockedResolve.mockResolvedValue(makeRequest({ status: 'approved' }))
    const onResolved = vi.fn()

    render(<PatientProfileChangeReview requests={[makeRequest()]} onResolved={onResolved} />)
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar cambios' }))

    await waitFor(() =>
      expect(mockedResolve).toHaveBeenCalledWith(1, 'approve', null),
    )
    expect(onResolved).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Cambios aceptados. Tus datos se actualizaron.')
  })

  it('rechaza los cambios enviando la nota del paciente', async () => {
    mockedResolve.mockResolvedValue(makeRequest({ status: 'rejected' }))
    const onResolved = vi.fn()

    render(<PatientProfileChangeReview requests={[makeRequest()]} onResolved={onResolved} />)
    await userEvent.type(
      screen.getByPlaceholderText('Nota para el médico (opcional)'),
      'No autorizo este cambio',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }))

    await waitFor(() =>
      expect(mockedResolve).toHaveBeenCalledWith(1, 'reject', 'No autorizo este cambio'),
    )
    expect(toast.success).toHaveBeenCalledWith('Cambios rechazados. Tus datos no se modificaron.')
  })

  it('muestra un error y no notifica si la resolución falla', async () => {
    mockedResolve.mockRejectedValue(new Error('boom'))
    const onResolved = vi.fn()

    render(<PatientProfileChangeReview requests={[makeRequest()]} onResolved={onResolved} />)
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar cambios' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(onResolved).not.toHaveBeenCalled()
  })
})
