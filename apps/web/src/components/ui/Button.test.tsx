import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Button from './Button'

describe('Button', () => {
  it('usa type="button" por defecto y dispara onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Guardar</Button>)

    const button = screen.getByRole('button', { name: 'Guardar' })
    expect(button).toHaveAttribute('type', 'button')

    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('en estado loading se deshabilita y expone aria-busy', () => {
    render(<Button loading>Sincronizando</Button>)

    const button = screen.getByRole('button', { name: 'Sincronizando' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('respeta el estado disabled explícito', () => {
    render(<Button disabled>No disponible</Button>)
    expect(screen.getByRole('button', { name: 'No disponible' })).toBeDisabled()
  })

  it('aplica el estilo de la variante success', () => {
    render(<Button variant="success">Aceptar</Button>)
    expect(screen.getByRole('button', { name: 'Aceptar' })).toHaveClass('bg-emerald-600')
  })
})
