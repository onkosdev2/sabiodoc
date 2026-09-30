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
  it('muestra los beneficios y pasos para pacientes por defecto', () => {
    renderPage()
    expect(screen.getByText('Encuentra tu especialidad con IA')).toBeInTheDocument()
    expect(screen.getByText('Resumen con los puntos clave')).toBeInTheDocument()
    expect(screen.getByText('Así funciona para pacientes')).toBeInTheDocument()
    expect(screen.getByText('Cuenta tu caso')).toBeInTheDocument()
  })

  it('cambia a la pestaña de médicos con sus propios pasos', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Para médicos' }))
    expect(screen.getByText('Consigue más pacientes')).toBeInTheDocument()
    expect(screen.getByText('Resumen automático de cada consulta')).toBeInTheDocument()
    expect(screen.getByText('Así funciona para médicos')).toBeInTheDocument()
    expect(screen.getByText('Postúlate y verifica tu perfil')).toBeInTheDocument()
    // Los contenidos de paciente ya no deben verse
    expect(screen.queryByText('Encuentra tu especialidad con IA')).not.toBeInTheDocument()
    expect(screen.queryByText('Así funciona para pacientes')).not.toBeInTheDocument()
    expect(screen.queryByText('Cuenta tu caso')).not.toBeInTheDocument()
  })
})
