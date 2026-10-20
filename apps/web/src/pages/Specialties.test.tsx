import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Specialties from './Specialties'
import { getSpecialties, getTopSpecialties } from '../api/specialties'

vi.mock('../api/specialties', () => ({
  getSpecialties: vi.fn(),
  getTopSpecialties: vi.fn(),
}))
const toast = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('../context/ToastContext', () => ({ useToast: () => toast }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null, isLoading: false }),
}))

const mockedGetSpecialties = vi.mocked(getSpecialties)
const mockedGetTopSpecialties = vi.mocked(getTopSpecialties)

function renderSpecialties() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Specialties />
    </MemoryRouter>,
  )
}

describe('Specialties', () => {
  beforeEach(() => {
    mockedGetSpecialties.mockReset()
    mockedGetTopSpecialties.mockReset()
  })

  it('muestra un estado de búsqueda y no "0 resultados" mientras espera', async () => {
    let resolveSearch: (value: { specialties: never[] }) => void = () => {}
    mockedGetTopSpecialties.mockResolvedValue({ specialties: [] } as never)
    mockedGetSpecialties
      .mockResolvedValueOnce({ specialties: [] } as never)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSearch = resolve as (value: { specialties: never[] }) => void
          }) as never,
      )

    renderSpecialties()
    await waitFor(() => expect(mockedGetSpecialties).toHaveBeenCalledTimes(1))

    await userEvent.type(screen.getByLabelText(/Buscar especialidad/i), 'cardio')

    await waitFor(() => expect(screen.getByText('Buscando…')).toBeInTheDocument())
    expect(screen.queryByText(/Resultados \(0\)/)).not.toBeInTheDocument()

    await waitFor(() => expect(mockedGetSpecialties).toHaveBeenCalledTimes(2))
    await act(async () => resolveSearch({ specialties: [] }))
    await waitFor(() => expect(screen.getByText('Sin resultados')).toBeInTheDocument())
  })
})
