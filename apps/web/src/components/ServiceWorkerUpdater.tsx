import { useEffect, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

import Button from './ui/Button'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * Avisa cuando hay una nueva versión de la app lista (nuevo service worker en
 * espera) y permite al usuario recargar cuando quiera. La nueva versión no se
 * activa hasta que el usuario lo confirma, para no cambiar el shell en caliente.
 */
export default function ServiceWorkerUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const userRequestedUpdateRef = useRef(false)

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

    let cancelled = false
    let updateCheckCleanup: (() => void) | undefined

    const markUpdate = () => {
      if (!cancelled) setUpdateAvailable(true)
    }

    const trackWorker = (worker: ServiceWorker) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          markUpdate()
        }
      })
    }

    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        if (cancelled) return
        registrationRef.current = registration

        if (registration.waiting && navigator.serviceWorker.controller) {
          markUpdate()
        }
        if (registration.installing) {
          trackWorker(registration.installing)
        }
        registration.addEventListener('updatefound', () => {
          if (registration.installing) trackWorker(registration.installing)
        })

        const check = () => registration.update().catch(() => {})
        window.addEventListener('focus', check)
        const interval = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS)
        updateCheckCleanup = () => {
          window.removeEventListener('focus', check)
          window.clearInterval(interval)
        }
      })
      .catch(() => {
        /* El service worker es best-effort. */
      })

    let reloading = false
    const handleControllerChange = () => {
      if (!userRequestedUpdateRef.current || reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      cancelled = true
      updateCheckCleanup?.()
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  const handleUpdate = () => {
    userRequestedUpdateRef.current = true
    const waiting = registrationRef.current?.waiting
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' })
    } else {
      window.location.reload()
    }
  }

  if (!updateAvailable) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[90] flex justify-center p-4 sm:justify-end"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
        <RefreshCw className="h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
        <p className="text-sm text-slate-700">Hay una nueva versión disponible.</p>
        <Button size="sm" onClick={handleUpdate}>
          Actualizar
        </Button>
        <button
          type="button"
          onClick={() => setUpdateAvailable(false)}
          aria-label="Cerrar aviso"
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
