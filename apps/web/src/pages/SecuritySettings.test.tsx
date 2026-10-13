import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import SecuritySettings from './SecuritySettings'
import { changePassword } from '../api/auth'
import { useAuth } from '../context/AuthContext'

vi.mock('../api/auth', () => ({ changePassword: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))

const mockedChange = vi.mocked(changePassword)
const mockedUseAuth = vi.mocked(useAuth)
const updateToken = vi.fn()

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SecuritySettings />
    </MemoryRouter>,
  )
}

describe('SecuritySettings', () => {
  beforeEach(() => {
    updateToken.mockClear()
    mockedUseAuth.mockReturnValue({ updateToken } as never)
  })

  it('valida la política y la confirmación', async () => {
    renderPage()

    await userEvent.type(screen.getByLabelText(/Contraseña actual/), 'Actual123')
    await userEvent.type(screen.getByLabelText(/Nueva contraseña/), 'sololetras')
    await userEvent.type(screen.getByLabelText(/Confirmar nueva contraseña/), 'otra')
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(screen.getByText('Debe incluir al menos un número.')).toBeInTheDocument()
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(mockedChange).not.toHaveBeenCalled()
  })

  it('cambia la contraseña y actualiza el token de sesión', async () => {
    mockedChange.mockResolvedValue({
      message: 'Contraseña actualizada. Por seguridad, cerramos tus otras sesiones.',
      access_token: 'nuevo-token',
      token_type: 'bearer',
    })
    renderPage()

    await userEvent.type(screen.getByLabelText(/Contraseña actual/), 'Actual123')
    await userEvent.type(screen.getByLabelText(/Nueva contraseña/), 'NuevaPass123')
    await userEvent.type(screen.getByLabelText(/Confirmar nueva contraseña/), 'NuevaPass123')
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument()
    expect(mockedChange).toHaveBeenCalledWith('Actual123', 'NuevaPass123')
    expect(updateToken).toHaveBeenCalledWith('nuevo-token')
  })

  it('muestra el error si la contraseña actual es incorrecta', async () => {
    mockedChange.mockRejectedValue({
      response: { data: { detail: 'La contraseña actual es incorrecta.' } },
    })
    renderPage()

    await userEvent.type(screen.getByLabelText(/Contraseña actual/), 'Incorrecta1')
    await userEvent.type(screen.getByLabelText(/Nueva contraseña/), 'NuevaPass123')
    await userEvent.type(screen.getByLabelText(/Confirmar nueva contraseña/), 'NuevaPass123')
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(await screen.findByText('La contraseña actual es incorrecta.')).toBeInTheDocument()
    expect(updateToken).not.toHaveBeenCalled()
  })
})
