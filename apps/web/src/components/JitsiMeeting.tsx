import { useEffect, useRef, useState } from 'react'

/**
 * Integración con el API externo (IFrame API) de Jitsi Meet.
 * https://jitsi.org/api/
 *
 * Carga `external_api.js` desde el dominio de la sala y monta la reunión en un
 * contenedor propio. El dominio y el nombre de la sala se derivan de la URL que
 * ya genera el backend, así que funciona tanto con `meet.jit.si` como con un
 * Jitsi self-hosted (con o sin JWT).
 */

interface JitsiApi {
  dispose: () => void
  addListener: (event: string, handler: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiApi
  }
}

// Cachea la carga del script por dominio (evita inyectarlo varias veces).
const scriptPromises = new Map<string, Promise<void>>()

function loadJitsiScript(domain: string, protocol: string): Promise<void> {
  const cached = scriptPromises.get(domain)
  if (cached) return cached

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${protocol}//${domain}/external_api.js`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar el API de Jitsi.'))
    document.head.appendChild(script)
  })

  scriptPromises.set(domain, promise)
  return promise
}

interface JitsiMeetingProps {
  roomUrl: string
  jwt?: string | null
  displayName?: string
  email?: string
  onJoined?: () => void
  onLeft?: () => void
  onError?: (message: string) => void
}

export default function JitsiMeeting({
  roomUrl,
  jwt,
  displayName,
  email,
  onJoined,
  onLeft,
  onError,
}: JitsiMeetingProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<JitsiApi | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  // Callbacks en refs para no reiniciar la reunión si el padre re-renderiza.
  const callbacksRef = useRef({ onJoined, onLeft, onError })
  callbacksRef.current = { onJoined, onLeft, onError }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let parsed: URL
    try {
      parsed = new URL(roomUrl)
    } catch {
      setStatus('error')
      callbacksRef.current.onError?.('La URL de la sala no es válida.')
      return
    }

    const domain = parsed.host
    const roomName = parsed.pathname.replace(/^\/+/, '')

    loadJitsiScript(domain, parsed.protocol)
      .then(() => {
        if (disposed || !window.JitsiMeetExternalAPI) return

        const api = new window.JitsiMeetExternalAPI(domain, {
          roomName,
          parentNode: container,
          jwt: jwt || undefined,
          userInfo: { displayName, email },
          configOverwrite: {
            prejoinConfig: { enabled: false },
            disableDeepLinking: true,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
            SHOW_JITSI_WATERMARK: false,
          },
        })

        apiRef.current = api
        setStatus('ready')
        api.addListener('videoConferenceJoined', () => callbacksRef.current.onJoined?.())
        api.addListener('readyToClose', () => callbacksRef.current.onLeft?.())
      })
      .catch((error: Error) => {
        if (disposed) return
        setStatus('error')
        callbacksRef.current.onError?.(error.message)
      })

    return () => {
      disposed = true
      apiRef.current?.dispose()
      apiRef.current = null
    }
  }, [roomUrl, jwt, displayName, email])

  return (
    <div className="jitsi-meeting-frame relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
          Cargando videollamada…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-amber-300">
          No se pudo cargar la videollamada. Puedes abrir la sala en una pestaña nueva.
        </div>
      )}
    </div>
  )
}
