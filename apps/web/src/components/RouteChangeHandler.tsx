import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { getDocumentTitle } from '../utils/routeTitles'

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * Efectos globales de navegación:
 * - actualiza `document.title` en cada ruta;
 * - vuelve al inicio de la página;
 * - mueve el foco al encabezado principal para que los lectores de pantalla
 *   anuncien el cambio de página (accesibilidad en SPA).
 */
export default function RouteChangeHandler() {
  const { pathname } = useLocation()
  const isFirstRender = useRef(true)

  useEffect(() => {
    const url = `${window.location.origin}${pathname}`
    document.title = getDocumentTitle(pathname)

    // Canonical y og:url por ruta (los crawlers que ejecutan JS lo agradecen).
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = url
    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]')
    if (ogUrl) ogUrl.content = url

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })

    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    // No robamos el foco si la página enfocó un campo (p. ej. autofocus).
    const active = document.activeElement
    if (active && EDITABLE_TAGS.has(active.tagName)) return

    const heading =
      document.querySelector<HTMLElement>('#main-content h1') ??
      document.querySelector<HTMLElement>('h1')
    if (heading) {
      heading.setAttribute('tabindex', '-1')
      heading.focus({ preventScroll: true })
    }
  }, [pathname])

  return null
}
