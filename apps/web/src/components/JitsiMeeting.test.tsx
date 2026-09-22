import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

import JitsiMeeting from './JitsiMeeting'

const instances: MockJitsiApi[] = []

class MockJitsiApi {
  listeners: Record<string, () => void> = {}
  dispose = vi.fn()
  addListener = vi.fn((event: string, handler: () => void) => {
    this.listeners[event] = handler
  })

  constructor(
    public domain: string,
    public options: Record<string, any>,
  ) {
    instances.push(this)
  }
}

describe('JitsiMeeting', () => {
  beforeEach(() => {
    instances.length = 0
    ;(window as any).JitsiMeetExternalAPI = MockJitsiApi

    // Simula la carga de external_api.js disparando onload al insertarlo.
    vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
      const element = node as HTMLScriptElement
      if (element.tagName === 'SCRIPT') {
        queueMicrotask(() => element.onload?.(new Event('load')))
      }
      return node
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as any).JitsiMeetExternalAPI
  })

  it('carga el API externo y monta la reunión con los datos del participante', async () => {
    const onJoined = vi.fn()
    const { unmount } = render(
      <JitsiMeeting
        roomUrl="https://meet.jit.si/SabioDoc-123"
        jwt="token-jwt"
        displayName="Ana Pérez"
        email="ana@example.com"
        onJoined={onJoined}
      />,
    )

    await waitFor(() => expect(instances).toHaveLength(1))
    const api = instances[0]

    expect(api.domain).toBe('meet.jit.si')
    expect(api.options.roomName).toBe('SabioDoc-123')
    expect(api.options.jwt).toBe('token-jwt')
    expect(api.options.userInfo).toEqual({ displayName: 'Ana Pérez', email: 'ana@example.com' })

    api.listeners.videoConferenceJoined?.()
    expect(onJoined).toHaveBeenCalledTimes(1)

    unmount()
    expect(api.dispose).toHaveBeenCalledTimes(1)
  })

  it('notifica cuando la URL de la sala no es válida', async () => {
    const onError = vi.fn()

    render(<JitsiMeeting roomUrl="esto-no-es-una-url" onError={onError} />)

    await waitFor(() => expect(onError).toHaveBeenCalled())
    expect(instances).toHaveLength(0)
  })
})
