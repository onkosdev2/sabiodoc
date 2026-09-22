import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Pagination from './Pagination'

const base = { pageSize: 10, totalItems: 25, totalPages: 3 }

describe('Pagination', () => {
  it('no renderiza nada si todo cabe en una sola página', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} totalItems={5} pageSize={10} onPageChange={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra el rango de elementos y la página actual', () => {
    render(<Pagination page={2} {...base} onPageChange={vi.fn()} />)

    expect(screen.getByText(/Mostrando/)).toHaveTextContent('Mostrando 11–20 de 25')
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument()
  })

  it('navega a la página siguiente y anterior', async () => {
    const onPageChange = vi.fn()
    render(<Pagination page={2} {...base} onPageChange={onPageChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(onPageChange).toHaveBeenCalledWith(3)

    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('deshabilita los controles en los límites', () => {
    const { rerender } = render(<Pagination page={1} {...base} onPageChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeEnabled()

    rerender(<Pagination page={3} {...base} onPageChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled()
  })
})
