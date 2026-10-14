import { useEffect } from 'react'

/**
 * Marca la página actual como no indexable.
 *
 * Se usa en estados de "no encontrado" de la SPA (que responden HTTP 200 por ser
 * una app cliente). Retira el canonical autorreferente mientras dure el estado
 * y lo restaura al salir.
 */
export function useNoIndex(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const head = document.head
    let meta = head.querySelector<HTMLMetaElement>('meta[name="robots"]')
    const created = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'robots')
      head.appendChild(meta)
    }
    const previous = meta.getAttribute('content')
    meta.setAttribute('content', 'noindex, nofollow')

    const canonical = head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const previousCanonical = canonical?.getAttribute('href') ?? null
    canonical?.remove()

    return () => {
      if (created) {
        meta?.remove()
      } else if (previous !== null) {
        meta?.setAttribute('content', previous)
      }
      if (previousCanonical !== null) {
        const link = document.createElement('link')
        link.setAttribute('rel', 'canonical')
        link.setAttribute('href', previousCanonical)
        head.appendChild(link)
      }
    }
  }, [enabled])
}
