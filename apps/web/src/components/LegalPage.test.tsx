import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import LegalPage from './LegalPage'

describe('LegalPage', () => {
  it('muestra versión y estado sin hablar de borrador provisional', () => {
    render(
      <MemoryRouter>
        <LegalPage
          title="Política de prueba"
          description="Descripción"
          updated="19 de octubre de 2026"
          version="1.0"
          status="pending_legal_review"
          sections={[{ heading: 'Sección', paragraphs: ['Texto.'] }]}
        />
      </MemoryRouter>,
    )

    expect(screen.getAllByText(/Versión 1.0/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Pendiente de revisión legal/)).toBeInTheDocument()
    expect(screen.queryByText(/Borrador provisional/)).not.toBeInTheDocument()
  })

  it('muestra el estado aprobado cuando corresponde', () => {
    render(
      <MemoryRouter>
        <LegalPage
          title="Política de prueba"
          description="Descripción"
          updated="19 de octubre de 2026"
          version="1.0"
          status="approved"
          sections={[{ heading: 'Sección' }]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Aprobada/)).toBeInTheDocument()
  })
})
