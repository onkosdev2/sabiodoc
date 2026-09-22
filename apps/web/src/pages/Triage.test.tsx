import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Triage from './Triage'
import { getMyPatientProfile } from '../api/patients'
import { submitTriage } from '../api/triage'
import { useAuth } from '../context/AuthContext'

vi.mock('../api/patients', () => ({ getMyPatientProfile: vi.fn() }))
vi.mock('../api/triage', () => ({ submitTriage: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../components/TriageResultCard', () => ({ default: () => null }))

const mockedProfile = vi.mocked(getMyPatientProfile)
const mockedSubmit = vi.mocked(submitTriage)
const mockedUseAuth = vi.mocked(useAuth)

function renderTriage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Triage />
    </MemoryRouter>,
  )
}

describe('Triage', () => {
  beforeEach(() => {
    mockedProfile.mockReset()
    mockedSubmit.mockReset()
    mockedUseAuth.mockReset()
  })

  it('prellena edad y sexo desde el perfil del paciente autenticado', async () => {
    mockedUseAuth.mockReturnValue({ isAuthenticated: true } as never)
    mockedProfile.mockResolvedValue({ age: 34, sex: 'female' } as never)

    renderTriage()

    await waitFor(() => expect(screen.getByLabelText(/Edad/)).toHaveValue(34))
    expect(screen.getByLabelText(/Sexo/)).toHaveValue('female')
  })

  it('no consulta el perfil si no hay sesión', async () => {
    mockedUseAuth.mockReturnValue({ isAuthenticated: false } as never)

    renderTriage()
    await screen.findByText('Describir mi caso')

    expect(mockedProfile).not.toHaveBeenCalled()
  })

  it('exige una descripción con longitud mínima', async () => {
    mockedUseAuth.mockReturnValue({ isAuthenticated: false } as never)

    renderTriage()
    await userEvent.type(screen.getByLabelText(/síntomas/i), 'dolor')
    await userEvent.click(screen.getByRole('button', { name: 'Analizar síntomas' }))

    expect(screen.getByText('Describe tus síntomas con al menos 10 caracteres.')).toBeInTheDocument()
    expect(mockedSubmit).not.toHaveBeenCalled()
  })

  it('envía los síntomas junto con edad y sexo del perfil', async () => {
    mockedUseAuth.mockReturnValue({ isAuthenticated: true } as never)
    mockedProfile.mockResolvedValue({ age: 34, sex: 'female' } as never)
    mockedSubmit.mockResolvedValue({ id: 1, result: {} as never, created_at: '' })

    renderTriage()
    await waitFor(() => expect(screen.getByLabelText(/Edad/)).toHaveValue(34))

    await userEvent.type(screen.getByLabelText(/síntomas/i), 'Me duele el pecho al respirar')
    await userEvent.click(screen.getByRole('button', { name: 'Analizar síntomas' }))

    await waitFor(() =>
      expect(mockedSubmit).toHaveBeenCalledWith({
        symptoms_text: 'Me duele el pecho al respirar',
        age: 34,
        sex: 'female',
      }),
    )
    expect(await screen.findByRole('button', { name: 'Hacer otra consulta' })).toBeInTheDocument()
  })
})
