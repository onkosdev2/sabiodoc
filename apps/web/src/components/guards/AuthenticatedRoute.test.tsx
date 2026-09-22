import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import AuthenticatedRoute from './AuthenticatedRoute'
import { useAuth } from '../../context/AuthContext'

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)

function renderAt(path: string) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}>
      <Routes>
        <Route element={<AuthenticatedRoute />}>
          <Route path="/privado" element={<div>Contenido privado</div>} />
        </Route>
        <Route path="/login" element={<div>Pantalla de login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuthenticatedRoute', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset()
  })

  it('redirige a /login cuando no hay sesión', () => {
    mockedUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false } as never)

    renderAt('/privado')

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument()
  })

  it('muestra el contenido protegido cuando hay sesión', () => {
    mockedUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false } as never)

    renderAt('/privado')

    expect(screen.getByText('Contenido privado')).toBeInTheDocument()
  })

  it('no redirige mientras la sesión está cargando', () => {
    mockedUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true } as never)

    renderAt('/privado')

    expect(screen.queryByText('Pantalla de login')).not.toBeInTheDocument()
    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument()
  })
})
