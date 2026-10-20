import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import ErrorSummary from './ErrorSummary'

describe('ErrorSummary', () => {
  it('no renderiza nada con menos de dos errores', () => {
    const { container } = render(<ErrorSummary errors={{}} />)
    expect(container).toBeEmptyDOMElement()

    const { container: one } = render(<ErrorSummary errors={{ email: 'Ingresa tu correo.' }} />)
    expect(one).toBeEmptyDOMElement()
  })

  it('lista todos los errores cuando hay varios', () => {
    render(
      <ErrorSummary
        errors={{
          email: 'Ingresa tu correo.',
          password: 'Ingresa tu contraseña.',
          omitido: undefined,
        }}
      />,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tu correo.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument()
  })
})
