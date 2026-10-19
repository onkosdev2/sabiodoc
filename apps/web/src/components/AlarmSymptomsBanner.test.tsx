import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import AlarmSymptomsBanner from './AlarmSymptomsBanner'

describe('AlarmSymptomsBanner', () => {
  it('no renderiza nada sin banderas de alarma', () => {
    const { container } = render(
      <MemoryRouter>
        <AlarmSymptomsBanner flags={[]} />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra el aviso y los enlaces de emergencia cuando hay banderas', () => {
    render(
      <MemoryRouter>
        <AlarmSymptomsBanner flags={['Dolor o presión en el pecho']} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Esto podría ser una urgencia médica/i)).toBeInTheDocument()
    expect(screen.getByText(/Dolor o presión en el pecho/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver números de emergencia/i })).toHaveAttribute(
      'href',
      '/emergency',
    )
  })
})
