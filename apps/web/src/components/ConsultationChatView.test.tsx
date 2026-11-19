import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import ConsultationChatView from './ConsultationChatView'
import { getConsultation, getChatHistory, type Consultation } from '../api/consultations'

vi.mock('../api/consultations', () => ({
  getConsultation: vi.fn(),
  getChatHistory: vi.fn(),
  startChat: vi.fn(),
  sendChatMessage: vi.fn(),
  generateSummary: vi.fn(),
  closeConsultation: vi.fn(),
  deleteConsultation: vi.fn(),
}))

const mockedGetConsultation = vi.mocked(getConsultation)
const mockedGetChatHistory = vi.mocked(getChatHistory)

function makeClosedConsultation(summary: string | null): Consultation {
  return {
    id: 42,
    specialty_id: 7,
    status: 'closed',
    room_id: 'room-42',
    created_at: '2026-01-01T10:00:00Z',
    closed_at: '2026-01-01T11:00:00Z',
    auto_closed: false,
    last_activity_at: '2026-01-01T11:00:00Z',
    summary,
    intake: null,
    specialty: { id: 7, name: 'Cardiología', slug: 'cardiologia' } as Consultation['specialty'],
  }
}

function renderView() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ConsultationChatView consultationId={42} />
    </MemoryRouter>,
  )
}

describe('ConsultationChatView', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    mockedGetConsultation.mockReset()
    mockedGetChatHistory.mockReset()
    mockedGetChatHistory.mockResolvedValue({
      messages: [
        {
          id: 1,
          consultation_id: 42,
          role: 'assistant',
          content: 'Hola, cuéntame qué te trae por aquí.',
          created_at: '2026-01-01T10:00:00Z',
        },
      ],
      consultation_id: 42,
      specialty_name: 'Cardiología',
    })
  })

  it('ofrece agendar la videoconsulta cuando la pre-consulta tiene resumen', async () => {
    mockedGetConsultation.mockResolvedValue(makeClosedConsultation('Resumen para el médico'))

    renderView()

    const bookLink = await screen.findByRole('link', { name: /Agendar videoconsulta/i })
    expect(bookLink).toHaveAttribute('href', '/specialties/cardiologia/?consultation=42')
    expect(screen.getByRole('link', { name: /Ver mi historial/i })).toHaveAttribute(
      'href',
      '/me/consultations',
    )
  })

  it('ofrece iniciar otra pre-consulta cuando se cerró sin resumen', async () => {
    mockedGetConsultation.mockResolvedValue(makeClosedConsultation(null))

    renderView()

    const restartLink = await screen.findByRole('link', { name: /Iniciar nueva consulta/i })
    expect(restartLink).toHaveAttribute('href', '/specialties/cardiologia/')
    expect(screen.queryByRole('link', { name: /Agendar videoconsulta/i })).not.toBeInTheDocument()
  })
})
