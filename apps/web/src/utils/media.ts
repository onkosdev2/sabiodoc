export type MediaStatus =
  | 'unknown'
  | 'checking'
  | 'ok'
  | 'unsupported'
  | 'denied'
  | 'not-found'
  | 'busy'
  | 'overconstrained'
  | 'timeout'
  | 'error'

interface MediaErrorLike {
  name?: string
  message?: string
}

/** Traduce el error de getUserMedia a un estado y un mensaje accionable. */
export function classifyMediaError(error: unknown): { status: MediaStatus; message: string } {
  const name = (error as MediaErrorLike | null)?.name ?? ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return {
        status: 'denied',
        message:
          'El permiso de cámara o micrófono fue denegado. Habilítalo en el navegador y vuelve a intentar.',
      }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        status: 'not-found',
        message:
          'No encontramos una cámara o micrófono disponible. Conecta uno y vuelve a intentar.',
      }
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        status: 'busy',
        message:
          'La cámara o el micrófono están siendo usados por otra aplicación. Ciérrala y vuelve a intentar.',
      }
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return {
        status: 'overconstrained',
        message: 'El dispositivo seleccionado ya no está disponible. Elige otro dispositivo.',
      }
    case 'TimeoutError':
      return {
        status: 'timeout',
        message:
          'La comprobación tardó demasiado. Cierra otras aplicaciones que usen la cámara y vuelve a intentar.',
      }
    default:
      return {
        status: 'error',
        message:
          'No pudimos comprobar los dispositivos. Vuelve a intentar o entra a la sala; Jitsi volverá a pedir permiso.',
      }
  }
}

/** getUserMedia con límite de tiempo; detiene el stream si llega tarde. */
export function getUserMediaWithTimeout(
  constraints: MediaStreamConstraints,
  timeoutMs = 12_000,
): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      settled = true
      reject({ name: 'TimeoutError', message: 'Tiempo de espera agotado' })
    }, timeoutMs)

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        if (settled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        clearTimeout(timer)
        resolve(stream)
      })
      .catch((error) => {
        clearTimeout(timer)
        if (!settled) reject(error)
      })
  })
}
