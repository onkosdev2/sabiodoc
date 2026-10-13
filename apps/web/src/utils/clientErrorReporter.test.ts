import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { reportClientError } from './clientErrorReporter'

describe('reportClientError', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('envía el error al backend con su contexto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)

    reportClientError({
      message: `Fallo de prueba ${Math.random()}`,
      error: new Error('detalle interno'),
      videoSessionId: 123,
      context: { room_name: 'SabioDoc-1-abc' },
    })

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, options] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/client-errors/client-error')
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.video_session_id).toBe(123)
    expect(body.error_type).toBe('Error')
    expect(body.context.room_name).toBe('SabioDoc-1-abc')
  })

  it('no vuelve a enviar el mismo error dentro de la ventana de deduplicación', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)
    const message = `Error repetido ${Math.random()}`

    reportClientError({ message })
    reportClientError({ message })

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })
})
