import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { getDocumentTitle } from '../utils/routeTitles'

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

const DEFAULT_DESCRIPTION =
  'SabioDoc te ayuda a encontrar la especialidad médica adecuada y a agendar videoconsultas con médicos verificados.'

/** Descripción SEO por ruta pública (el título lo resuelve `getDocumentTitle`). */
const ROUTE_DESCRIPTIONS: Record<string, string> = {
  '/': DEFAULT_DESCRIPTION,
  '/como-funciona':
    'Descubre cómo SabioDoc usa IA para orientarte a la especialidad correcta, preparar tu consulta y atenderte por videollamada pagando solo por minuto.',
  '/specialties':
    'Explora especialidades médicas y encuentra al especialista adecuado por nombre o síntomas. Agenda tu videoconsulta.',
  '/triage':
    'Cuéntanos tus síntomas con tus palabras y la IA te orienta hacia la especialidad médica adecuada.',
  '/guide':
    'Responde unas preguntas sencillas y te guiamos paso a paso hacia la especialidad médica que necesitas.',
  '/emergency':
    'Información importante sobre cuándo acudir a urgencias y cómo actuar ante una emergencia médica.',
  '/doctor/apply':
    'Postúlate como médico en SabioDoc: atiende videoconsultas, recibe resúmenes de pre-consulta con IA y define tu tarifa por minuto.',
}

function setMetaContent(selector: string, content: string) {
  const element = document.querySelector<HTMLMetaElement>(selector)
  if (element) element.content = content
}

/**
 * Efectos globales de navegación:
 * - actualiza `document.title` y las meta descripciones/OG en cada ruta;
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

    const description = ROUTE_DESCRIPTIONS[pathname]
    // En rutas dinámicas (especialidad/médico) la página fija su propia
    // descripción; no la pisamos con la genérica para no perder la específica.
    const isDynamicPublic =
      pathname.startsWith('/specialties/') || pathname.startsWith('/doctors/')
    if (description || !isDynamicPublic) {
      const content = description ?? DEFAULT_DESCRIPTION
      setMetaContent('meta[name="description"]', content)
      setMetaContent('meta[property="og:description"]', content)
      setMetaContent('meta[name="twitter:description"]', content)
    }
    setMetaContent('meta[property="og:title"]', document.title)
    setMetaContent('meta[name="twitter:title"]', document.title)

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
