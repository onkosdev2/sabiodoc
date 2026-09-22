import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import ForgotPassword from './ForgotPassword'
import { forgotPassword } from '../api/auth'
import { useAuth } from '../context/AuthContext'

vi.mock('../api/auth', () => ({ forgotPassword: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))

const mockedForgot = vi.mocked(forgotPassword)
const mockedUseAuth = vi.mocked(useAuth)

function renderPage() {
  return render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={['/forgot-password']}
    >
      <ForgotPassword />
    </MemoryRouter>,
  )
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({ user: null } as never)
  })

  it('valida el formato del correo antes de enviar', async () => {
    renderPage()

    await userEvent.type(screen.getByLabelText(/Correo electrónico/), 'no-valido')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(screen.getByText('El correo no parece válido.')).toBeInTheDocument()
    expect(mockedForgot).not.toHaveBeenCalled()
  })

  it('muestra un mensaje genérico tras enviar', async () => {
    mockedForgot.mockResolvedValue({ message: 'ok' })
    renderPage()

    await userEvent.type(screen.getByLabelText(/Correo electrónico/), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument()
    expect(mockedForgot).toHaveBeenCalledWith('ana@example.com')
  })
})
