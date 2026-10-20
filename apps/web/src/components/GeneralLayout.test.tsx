import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import GeneralLayout from './GeneralLayout'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}))
vi.mock('../context/NotificationsContext', () => ({
  useNotifications: () => ({ unread: 0 }),
}))

function renderLayout() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<GeneralLayout />}>
          <Route path="/" element={<div>Inicio</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('GeneralLayout', () => {
  it('abre y cierra el menú móvil con los enlaces públicos', async () => {
    renderLayout()

    const open = screen.getByRole('button', { name: 'Abrir menú' })
    expect(open).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(open)

    expect(open).toHaveAttribute('aria-expanded', 'true')
    const menu = document.getElementById('mobile-nav')
    expect(menu).not.toBeNull()
    expect(within(menu!).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(within(menu!).getByRole('link', { name: 'Registrarse' })).toHaveAttribute(
      'href',
      '/register',
    )

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar menú' }))
    expect(screen.queryByRole('button', { name: 'Cerrar menú' })).not.toBeInTheDocument()
  })
})
