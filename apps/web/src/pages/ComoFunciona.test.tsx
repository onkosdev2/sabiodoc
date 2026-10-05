import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import ComoFunciona from './ComoFunciona'

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ComoFunciona />
    </MemoryRouter>,
  )
}

describe('ComoFunciona', () => {
  it('muestra los beneficios y la infografía de pasos para pacientes por defecto', () => {
    renderPage()
    expect(screen.getByText('Orientación con IA')).toBeInTheDocument()
    expect(screen.getByText('Resumen e historial')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /pasos para el paciente/i })).toBeInTheDocument()
  })

  it('cambia a la pestaña de médicos con su propia infografía', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Médicos' }))
    expect(screen.getByText('Más pacientes')).toBeInTheDocument()
    expect(screen.getByText('Resumen automático')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /pasos para el médico/i })).toBeInTheDocument()
    // Los contenidos de paciente ya no deben verse
    expect(screen.queryByText('Orientación con IA')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /pasos para el paciente/i })).not.toBeInTheDocument()
  })
})
