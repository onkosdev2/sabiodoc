import { useEffect } from 'react'

interface SeoInput {
  title?: string
  description?: string
  image?: string
}

function setMeta(selector: string, content: string) {
  const element = document.querySelector<HTMLMetaElement>(selector)
  if (element) element.content = content
}

/**
 * Fija título y meta etiquetas específicas de una página dinámica (perfil del
 * médico, especialidad). Se ejecuta cuando la página ya tiene sus datos, por lo
 * que sus valores quedan por encima de los genéricos de `RouteChangeHandler`.
 */
export function useSeo({ title, description, image }: SeoInput) {
  useEffect(() => {
    if (title) {
      document.title = title
      setMeta('meta[property="og:title"]', title)
      setMeta('meta[name="twitter:title"]', title)
    }
    if (description) {
      setMeta('meta[name="description"]', description)
      setMeta('meta[property="og:description"]', description)
      setMeta('meta[name="twitter:description"]', description)
    }
    if (image) {
      setMeta('meta[property="og:image"]', image)
      setMeta('meta[name="twitter:image"]', image)
    }
  }, [title, description, image])
}
