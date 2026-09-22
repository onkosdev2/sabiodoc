import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, it, expect, vi } from 'vitest'

interface FakeResponse {
  body: string
  ok: boolean
  type: string
  clone: () => FakeResponse
}

function makeResponse(body: string): FakeResponse {
  return {
    body,
    ok: true,
    type: 'basic',
    clone: () => makeResponse(body),
  }
}

type Listener = (event: { waitUntil?: (p: Promise<unknown>) => void; respondWith?: (r: unknown) => void; request?: unknown }) => void

function createCaches() {
  const stores = new Map<string, Map<string, FakeResponse>>()

  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)!
    return {
      add: async (url: string) => {
        store.set(url, makeResponse(`cached:${url}`))
      },
      put: async (request: unknown, response: FakeResponse) => {
        const key = typeof request === 'string' ? request : (request as { url: string }).url
        store.set(key, response)
      },
      match: async (request: unknown) => {
        const key = typeof request === 'string' ? request : (request as { url: string }).url
        return store.get(key)
      },
    }
  }

  return {
    open,
    match: async (request: unknown) => {
      const key = typeof request === 'string' ? request : (request as { url: string }).url
      for (const store of stores.values()) {
        const hit = store.get(key)
        if (hit) return hit
      }
      return undefined
    },
    keys: async () => Array.from(stores.keys()),
    delete: async (name: string) => stores.delete(name),
  }
}

/** Carga la plantilla del SW en un contexto con globals de service worker simulados. */
function loadServiceWorker(fetchImpl: (request: unknown) => Promise<FakeResponse>) {
  const code = readFileSync(resolve(process.cwd(), 'scripts/sw-template.js'), 'utf8').replace(
    '__PRECACHE_MANIFEST__',
    JSON.stringify(['/index.html']),
  )

  const listeners: Record<string, Listener[]> = {}
  const self = {
    location: { origin: 'http://localhost' },
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
    addEventListener: (type: string, handler: Listener) => {
      if (!listeners[type]) listeners[type] = []
      listeners[type].push(handler)
    },
  }

  const caches = createCaches()
  const fetch = vi.fn(fetchImpl)

  const context = vm.createContext({ self, caches, fetch, URL, Promise, Error, console })
  new vm.Script(code).runInContext(context)

  const dispatch = (type: string, event: Record<string, unknown>) => {
    const handler = listeners[type]?.[0]
    if (!handler) throw new Error(`Sin listener ${type}`)
    handler(event as never)
  }

  return { listeners, self, caches, fetch, dispatch }
}

async function runInstall(sw: ReturnType<typeof loadServiceWorker>) {
  let installPromise: Promise<unknown> = Promise.resolve()
  sw.dispatch('install', { waitUntil: (promise: Promise<unknown>) => (installPromise = promise) })
  await installPromise
}

describe('service worker', () => {
  it('precachea el shell en el install', async () => {
    const sw = loadServiceWorker(async () => makeResponse('network'))
    await runInstall(sw)

    const cached = await sw.caches.match('/index.html')
    expect(cached?.body).toBe('cached:/index.html')
  })

  it('activa la nueva versión solo al recibir SKIP_WAITING', async () => {
    const sw = loadServiceWorker(async () => makeResponse('network'))
    await runInstall(sw)

    expect(sw.self.skipWaiting).not.toHaveBeenCalled()
    sw.dispatch('message', { data: { type: 'SKIP_WAITING' } })
    expect(sw.self.skipWaiting).toHaveBeenCalledTimes(1)
  })

  it('navegación offline: sirve el index.html precacheado cuando la red falla', async () => {
    const sw = loadServiceWorker(async () => {
      throw new Error('offline')
    })
    await runInstall(sw)

    let respondWith: Promise<unknown> | undefined
    await sw.dispatch('fetch', {
      request: { method: 'GET', url: 'http://localhost/', mode: 'navigate' },
      respondWith: (promise: unknown) => (respondWith = promise as Promise<unknown>),
    })

    const response = (await respondWith) as FakeResponse
    expect(response.body).toBe('cached:/index.html')
  })

  it('navegación online: usa la red y actualiza el shell cacheado', async () => {
    const sw = loadServiceWorker(async () => makeResponse('fresh-html'))
    await runInstall(sw)

    let respondWith: Promise<unknown> | undefined
    await sw.dispatch('fetch', {
      request: { method: 'GET', url: 'http://localhost/', mode: 'navigate' },
      respondWith: (promise: unknown) => (respondWith = promise as Promise<unknown>),
    })

    const response = (await respondWith) as FakeResponse
    expect(response.body).toBe('fresh-html')

    const runtime = await sw.caches.open('sabiodoc-runtime-v1')
    expect((await runtime.match('/index.html'))?.body).toBe('fresh-html')
  })

  it('assets con hash: cache-first (no vuelve a pedir a la red si está cacheado)', async () => {
    const sw = loadServiceWorker(async () => makeResponse('asset-js'))
    await runInstall(sw)
    const asset = { method: 'GET', url: 'http://localhost/assets/app-123.js', mode: 'cors' }

    const first = await new Promise<FakeResponse>((resolvePromise) => {
      sw.dispatch('fetch', { request: asset, respondWith: (p: unknown) => resolvePromise(p as Promise<FakeResponse>) })
    })
    expect(first.body).toBe('asset-js')
    expect(sw.fetch).toHaveBeenCalledTimes(1)

    const second = await new Promise<FakeResponse>((resolvePromise) => {
      sw.dispatch('fetch', { request: asset, respondWith: (p: unknown) => resolvePromise(p as Promise<FakeResponse>) })
    })
    expect(second.body).toBe('asset-js')
    expect(sw.fetch).toHaveBeenCalledTimes(1)
  })

  it('ignora peticiones de otros orígenes y métodos no GET', async () => {
    const sw = loadServiceWorker(async () => makeResponse('x'))
    await runInstall(sw)

    const external = { method: 'GET', url: 'https://api.sabiodoc.app/data', mode: 'cors' }
    const respondWith = vi.fn()
    sw.dispatch('fetch', { request: external, respondWith })
    expect(respondWith).not.toHaveBeenCalled()

    const post = { method: 'POST', url: 'http://localhost/api', mode: 'cors' }
    sw.dispatch('fetch', { request: post, respondWith })
    expect(respondWith).not.toHaveBeenCalled()
  })
})
