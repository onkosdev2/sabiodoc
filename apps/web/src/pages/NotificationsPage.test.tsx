import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import NotificationsPage from './NotificationsPage'
import type { NotificationItem } from '../api/notifications'

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: 1,
    type: 'appointment_booked',
    title: 'Cita agendada',
    body: 'Tu cita fue agendada.',
    action_url: null,
    action_label: null,
    status: 'read',
    created_at: '2026-01-01T10:00:00Z',
    read_at: null,
    metadata: null,
  },
  {
    id: 2,
    type: 'video_session_no_credits',
    title: 'Sin créditos',
    body: 'Te quedaste sin créditos.',
    action_url: '/me/wallet',
    action_label: 'Recargar',
    status: 'read',
    created_at: '2026-01-02T10:00:00Z',
    read_at: null,
    metadata: null,
  },
  {
    id: 3,
    type: 'appointment_cancelled',
    title: 'Cita cancelada',
    body: 'La cita fue cancelada.',
    action_url: null,
    action_label: null,
    status: 'read',
    created_at: '2026-01-03T10:00:00Z',
    read_at: null,
    metadata: null,
  },
]

const refresh = vi.fn().mockResolvedValue(undefined)
const markRead = vi.fn().mockResolvedValue(undefined)
const markAllRead = vi.fn().mockResolvedValue(undefined)

vi.mock('../context/NotificationsContext', () => ({
  useNotifications: () => ({
    notifications: NOTIFICATIONS,
    unread: 0,
    loading: false,
    error: null,
    refresh,
    markRead,
    markAllRead,
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NotificationsPage />
    </MemoryRouter>,
  )
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra la categoría y la acción de cada notificación', () => {
    renderPage()
    expect(screen.getAllByText('Citas').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Créditos').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Cancelaciones').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  })

  it('filtra las notificaciones por categoría', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: /cancelaciones/i }))

    expect(screen.getByText('Cita cancelada')).toBeInTheDocument()
    expect(screen.queryByText('Cita agendada')).not.toBeInTheDocument()
    expect(screen.queryByText('Sin créditos')).not.toBeInTheDocument()
  })
})
