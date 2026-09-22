/*
 * Service worker generado en build (ver vite.config.ts).
 *
 * Estrategias:
 * - Navegación (HTML): network-first. Siempre se intenta la red para no servir
 *   una app vieja; solo si falla (offline) se usa el shell precacheado.
 * - Assets con hash (/assets/): cache-first (precacheado e inmutable).
 * - Datos estáticos no hasheados (/cities/, imágenes, manifest, etc.):
 *   stale-while-revalidate.
 * - No se interceptan peticiones a la API ni a otros orígenes.
 */
const VERSION = 'v1'
const PRECACHE = `sabiodoc-precache-${VERSION}`
const RUNTIME = `sabiodoc-runtime-${VERSION}`
const KNOWN_CACHES = new Set([PRECACHE, RUNTIME])

/** Lista de URLs del build, inyectada por Vite. */
const PRECACHE_URLS = __PRECACHE_MANIFEST__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      // allSettled: si un asset falla, el SW igual se instala con el resto.
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))),
  )
})

// La nueva versión queda en espera hasta que el usuario confirme la actualización.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !KNOWN_CACHES.has(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

async function putIfCacheable(cache, request, response) {
  if (response && response.ok && response.type === 'basic') {
    await cache.put(request, response.clone())
  }
}

async function cacheFirst(request, cacheName) {
  // `caches.match` busca en todas las cachés, incluida la de precache.
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  const cache = await caches.open(cacheName)
  await putIfCacheable(cache, request, response)
  return response
}

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then((cache) => {
    const network = fetch(request)
      .then((response) => {
        putIfCacheable(cache, request, response)
        return response
      })
      .catch(() => undefined)

    return cache.match(request).then((cached) => cached || network)
  })
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    const cache = await caches.open(RUNTIME)
    if (response && response.ok) {
      cache.put('/index.html', response.clone())
    }
    return response
  } catch {
    // Preferimos el último HTML servido (runtime) y, si no, el precacheado.
    const runtime = await caches.open(RUNTIME)
    const cached = (await runtime.match('/index.html')) || (await caches.match('/index.html')) || (await caches.match('/'))
    if (cached) return cached
    throw new Error('offline')
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  const path = url.pathname
  if (path.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, RUNTIME))
    return
  }

  const isCityData = path.startsWith('/cities/')
  const isStaticFile = /\.(?:png|svg|ico|webmanifest|json|xml|txt|webp|woff2?)$/.test(path)
  if (isCityData || isStaticFile) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME))
  }
})
