import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const RELOAD_FLAG = 'sabiodoc:chunk-reload-attempted'

/**
 * `React.lazy` tolerante a fallos al cargar el chunk de una ruta.
 *
 * Cubre tres escenarios que de otro modo rompen la app:
 *  - un fallo transitorio de red / HMR al pedir el módulo,
 *  - que el módulo llegue vacío o sin `export default` (p. ej. el servidor de
 *    Vite sirviendo un módulo a medio transformar),
 *  - un chunk que ya no existe tras un despliegue.
 *
 * Reintenta una vez y, si sigue fallando, recarga la página una única vez para
 * reconstruir el grafo de módulos. Si aún así falla, lanza un error legible que
 * captura el `ErrorBoundary` (en vez del críptico error interno de React al
 * intentar formatear el aviso de `lazy`).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    const load = async () => {
      const module = await factory()
      if (!module || typeof module.default === 'undefined') {
        throw new Error('No se pudo cargar la página (módulo vacío).')
      }
      return module
    }

    try {
      const module = await load()
      sessionStorage.removeItem(RELOAD_FLAG)
      return module
    } catch (firstError) {
      try {
        const module = await load()
        sessionStorage.removeItem(RELOAD_FLAG)
        return module
      } catch (secondError) {
        // Una única recarga automática para recuperarnos de un grafo de módulos
        // corrupto (típico en desarrollo con HMR). El flag evita bucles.
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1')
          window.location.reload()
        }
        throw secondError instanceof Error
          ? secondError
          : new Error('No se pudo cargar la página. Recarga la aplicación.')
      }
    }
  })
}
