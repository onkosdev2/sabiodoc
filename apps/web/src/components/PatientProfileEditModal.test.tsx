import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import PatientProfileEditModal from './PatientProfileEditModal'
import { proposePatientProfileChanges } from '../api/doctors'
import type { PatientProfile, PatientProfileChangeRequest } from '../api/patients'

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  dismiss: vi.fn(),
}))

vi.mock('../api/doctors', () => ({ proposePatientProfileChanges: vi.fn() }))
vi.mock('../context/ToastContext', () => ({ useToast: () => toast }))

const mockedPropose = vi.mocked(proposePatientProfileChanges)

const PROFILE: PatientProfile = {
  id: 5,
  user_id: 10,
  email: 'ana@example.com',
  first_name: 'Ana',
  last_name: 'Pérez',
  date_of_birth: '1990-05-20',
  sex: 'female',
  phone: '+51 999888777',
  country: 'Perú',
  city: 'Lima',
  timezone: 'America/Lima',
  blood_type: 'O+',
  allergies: null,
  chronic_conditions: null,
  current_medications: null,
  family_history: null,
  height_cm: 170,
  weight_kg: 65,
  smoker: false,
  alcohol: false,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  notes: null,
  full_name: 'Ana Pérez',
  age: 35,
  created_at: null,
  updated_at: null,
}

const REQUEST: PatientProfileChangeRequest = {
  id: 9,
  patient_id: 10,
  patient_email: 'ana@example.com',
  patient_name: 'Ana Pérez',
  doctor_id: 3,
  doctor_name: 'Dr. López',
  status: 'pending',
  proposed_changes: { first_name: { from: 'Ana', to: 'Ana María' } },
  current_snapshot: {},
  doctor_message: 'Corrijo tu nombre',
  patient_note: null,
  created_at: '2026-01-01T10:00:00Z',
  resolved_at: null,
}

function renderModal(overrides: { onClose?: () => void; onSubmitted?: () => void } = {}) {
  return render(
    <PatientProfileEditModal
      open
      onClose={overrides.onClose ?? vi.fn()}
      patientId={10}
      patientName="Ana Pérez"
      profile={PROFILE}
      onSubmitted={overrides.onSubmitted ?? vi.fn()}
    />,
  )
}

describe('PatientProfileEditModal', () => {
  beforeEach(() => {
    mockedPropose.mockReset()
  })

  it('precarga los datos actuales del paciente', () => {
    renderModal()

    expect(screen.getByLabelText('Nombres')).toHaveValue('Ana')
    expect(screen.getByLabelText('Altura (cm)')).toHaveValue(170)
    expect(screen.getByLabelText('Sexo')).toHaveValue('female')
  })

  it('envía la propuesta con los cambios y el mensaje, y cierra el modal', async () => {
    mockedPropose.mockResolvedValue(REQUEST)
    const onClose = vi.fn()
    const onSubmitted = vi.fn()

    renderModal({ onClose, onSubmitted })

    const firstName = screen.getByLabelText('Nombres')
    await userEvent.clear(firstName)
    await userEvent.type(firstName, 'Ana María')
    await userEvent.type(
      screen.getByLabelText('Mensaje para el paciente (opcional)'),
      'Corrijo tu nombre',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }))

    await waitFor(() =>
      expect(mockedPropose).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ first_name: 'Ana María', doctor_message: 'Corrijo tu nombre' }),
      ),
    )
    expect(onSubmitted).toHaveBeenCalledWith(REQUEST)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalled()
  })

  it('muestra un error y no cierra si la propuesta falla', async () => {
    mockedPropose.mockRejectedValue(new Error('boom'))
    const onClose = vi.fn()

    renderModal({ onClose })
    await userEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
  })
})
