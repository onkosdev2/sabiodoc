import { describe, it, expect, vi, afterEach } from 'vitest'

import { streamNotifications } from './notifications'

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

describe('streamNotifications', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('entrega cada evento notification e ignora keep-alives', async () => {
    const onNotification = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'event: notification\ndata: {"id":1,"title":"Uno"}\n\n',
          ': keep-alive\n\n',
          'event: notification\ndata: {"id":2,"title":"Dos"}\n\n',
        ]),
      ),
    )

    await streamNotifications(onNotification)

    expect(onNotification).toHaveBeenCalledTimes(2)
    expect(onNotification).toHaveBeenNthCalledWith(1, { id: 1, title: 'Uno' })
    expect(onNotification).toHaveBeenNthCalledWith(2, { id: 2, title: 'Dos' })
  })

  it('reconstruye eventos partidos entre chunks', async () => {
    const onNotification = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse(['event: notification\ndata: {"id":3,', '"title":"Tres"}\n\n']),
      ),
    )

    await streamNotifications(onNotification)

    expect(onNotification).toHaveBeenCalledWith({ id: 3, title: 'Tres' })
  })

  it('rechaza si el servidor responde con error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))

    await expect(streamNotifications(vi.fn())).rejects.toThrow()
  })
})
