import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import Login from './Login'
import { login } from '../api/auth'
import { getMyPatientProfile } from '../api/patients'
import { useAuth } from '../context/AuthContext'

vi.mock('../api/auth', () => ({ login: vi.fn() }))
vi.mock('../api/patients', () => ({ getMyPatientProfile: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))

const mockedLogin = vi.mocked(login)
const mockedProfile = vi.mocked(getMyPatientProfile)
const mockedUseAuth = vi.mocked(useAuth)
const authLogin = vi.fn()

const PATIENT_RESPONSE = {
  access_token: 'token-123',
  token_type: 'bearer',
  user: { id: 1, email: 'ana@example.com', role: 'patient' as const, created_at: '' },
}

function renderLogin() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<div>Inicio paciente</div>} />
        <Route path="/me/profile" element={<div>Completar perfil</div>} />
        <Route path="/doctor/pending" element={<div>Panel médico pendiente</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function submitValidCredentials() {
  await userEvent.type(screen.getByLabelText(/Correo electrónico/), 'ana@example.com')
  await userEvent.type(screen.getByLabelText(/Contraseña/), 'secreto123')
  await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
}

describe('Login', () => {
  beforeEach(() => {
    authLogin.mockReset()
    mockedUseAuth.mockReturnValue({ login: authLogin } as never)
  })

  it('valida los campos obligatorios antes de enviar', async () => {
    renderLogin()

    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(screen.getByText('Ingresa tu correo.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument()
    expect(mockedLogin).not.toHaveBeenCalled()
  })

  it('lleva a completar el perfil si el paciente no tiene datos', async () => {
    mockedLogin.mockResolvedValue(PATIENT_RESPONSE)
    mockedProfile.mockResolvedValue({ first_name: null, sex: null } as never)

    renderLogin()
    await submitValidCredentials()

    expect(await screen.findByText('Completar perfil')).toBeInTheDocument()
    expect(authLogin).toHaveBeenCalledWith('token-123', expect.objectContaining({ email: 'ana@example.com' }), true)
  })

  it('lleva al portal del paciente si el perfil ya está completo', async () => {
    mockedLogin.mockResolvedValue(PATIENT_RESPONSE)
    mockedProfile.mockResolvedValue({ first_name: 'Ana', last_name: 'Pérez', sex: 'female' } as never)

    renderLogin()
    await submitValidCredentials()

    expect(await screen.findByText('Inicio paciente')).toBeInTheDocument()
  })

  it('si no se puede leer el perfil, cae al portal del paciente', async () => {
    mockedLogin.mockResolvedValue(PATIENT_RESPONSE)
    mockedProfile.mockRejectedValue(new Error('boom'))

    renderLogin()
    await submitValidCredentials()

    expect(await screen.findByText('Inicio paciente')).toBeInTheDocument()
  })

  it('lleva a los médicos a su panel pendiente', async () => {
    mockedLogin.mockResolvedValue({
      ...PATIENT_RESPONSE,
      user: { id: 2, email: 'doc@example.com', role: 'doctor' as const, created_at: '' },
    })

    renderLogin()
    await userEvent.type(screen.getByLabelText(/Correo electrónico/), 'doc@example.com')
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'secreto123')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('Panel médico pendiente')).toBeInTheDocument()
    expect(mockedProfile).not.toHaveBeenCalled()
  })
})
