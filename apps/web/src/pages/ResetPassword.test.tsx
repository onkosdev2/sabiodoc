import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import ResetPassword from './ResetPassword'
import { resetPassword } from '../api/auth'
import { useAuth } from '../context/AuthContext'

vi.mock('../api/auth', () => ({ resetPassword: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))

const mockedReset = vi.mocked(resetPassword)
const mockedUseAuth = vi.mocked(useAuth)

function renderPage(path: string) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}>
      <ResetPassword />
    </MemoryRouter>,
  )
}

describe('ResetPassword', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({ user: null } as never)
  })

  it('muestra enlace inválido si falta el token', () => {
    renderPage('/reset-password')
    expect(screen.getByText('Enlace inválido')).toBeInTheDocument()
  })

  it('valida longitud y confirmación de la contraseña', async () => {
    renderPage('/reset-password?token=abc123456789')

    await userEvent.type(screen.getByLabelText(/Nueva contraseña/), 'corta')
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'otra')
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(screen.getByText('Debe tener al menos 8 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(mockedReset).not.toHaveBeenCalled()
  })

  it('cambia la contraseña con el token', async () => {
    mockedReset.mockResolvedValue({ message: 'ok' })
    renderPage('/reset-password?token=abc123456789')

    await userEvent.type(screen.getByLabelText(/Nueva contraseña/), 'NuevaPass123')
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'NuevaPass123')
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument()
    expect(mockedReset).toHaveBeenCalledWith('abc123456789', 'NuevaPass123')
  })
})
