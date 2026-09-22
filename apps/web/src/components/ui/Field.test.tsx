import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Input, PasswordInput } from './Field'

describe('Input', () => {
  it('asocia label, error y aria-describedby de forma accesible', () => {
    render(<Input label="Correo" hint="Tu email" error="Correo inválido" />)

    const input = screen.getByLabelText('Correo')
    expect(input).toHaveAttribute('aria-invalid', 'true')

    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('Correo inválido')
    expect(input).toHaveAttribute('aria-describedby', error.id)
  })

  it('muestra el hint cuando no hay error', () => {
    render(<Input label="Correo" hint="Tu email" />)
    expect(screen.getByText('Tu email')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('PasswordInput', () => {
  it('alterna la visibilidad de la contraseña', async () => {
    render(<PasswordInput label="Contraseña" />)

    const input = screen.getByLabelText('Contraseña')
    expect(input).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(input).toHaveAttribute('type', 'text')

    const hide = screen.getByRole('button', { name: 'Ocultar contraseña' })
    expect(hide).toHaveAttribute('aria-pressed', 'true')
  })
})
