/**
 * Genera copias de `dist/index.html` con las meta etiquetas (title, description,
 * Open Graph, Twitter, canonical y JSON-LD) ya inyectadas para las rutas
 * públicas: fijas + especialidades + perfiles de médicos.
 *
 * Esto mejora cómo se ven los enlaces al compartirlos (WhatsApp, Facebook, X) y
 * lo que leen los crawlers sin ejecutar JavaScript. El contenido sigue siendo la
 * SPA; solo se adelantan las meta etiquetas.
 *
 * Se ejecuta en `postbuild`. Consulta la API con `VITE_API_URL`; si no está
 * disponible, se omite sin romper el build.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const distDir = resolve(projectRoot, 'dist')
const baseHtmlPath = resolve(distDir, 'index.html')

function loadEnvFile(file) {
  if (!existsSync(file)) return {}
  const env = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
  }
  return env
}

const fileEnv = {
  ...loadEnvFile(resolve(projectRoot, '.env')),
  ...loadEnvFile(resolve(projectRoot, '.env.local')),
}
const apiUrl = (process.env.VITE_API_URL || fileEnv.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')
const siteUrl = (process.env.VITE_SITE_URL || fileEnv.VITE_SITE_URL || 'https://sabiodoc.app').replace(/\/+$/, '')

const DEFAULT_TITLE = 'SabioDoc - Orientación Médica Inteligente'
const DEFAULT_DESCRIPTION =
  'Orientación médica con IA, agenda de videoconsultas y pago por minuto. Encuentra la especialidad adecuada y atiéndete con profesionales verificados.'
const DEFAULT_IMAGE = `${siteUrl}/og-image.png`
const DEFAULT_IMAGE_ALT = 'SabioDoc - Orientación médica inteligente con IA'

const SITE_JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SabioDoc',
    url: siteUrl,
    logo: `${siteUrl}/og-image.png`,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'SabioDoc',
    url: siteUrl,
  },
]

const STATIC_META = {
  '/como-funciona': {
    title: 'Cómo funciona SabioDoc',
    description:
      'Descubre cómo SabioDoc usa IA para orientarte a la especialidad correcta, preparar tu consulta y atenderte por videollamada pagando solo por minuto.',
  },
  '/specialties': {
    title: 'Especialidades médicas',
    description:
      'Explora especialidades médicas y encuentra al especialista adecuado por nombre o síntomas. Agenda tu videoconsulta.',
  },
  '/triage': {
    title: 'Describir mi caso',
    description:
      'Cuéntanos tus síntomas con tus palabras y la IA te orienta hacia la especialidad médica adecuada.',
  },
  '/guide': {
    title: 'Guía de especialidades',
    description:
      'Responde unas preguntas sencillas y te guiamos paso a paso hacia la especialidad médica que necesitas.',
  },
  '/emergency': {
    title: 'Emergencias',
    description:
      'Información importante sobre cuándo acudir a urgencias y cómo actuar ante una emergencia médica.',
  },
  '/telemedicina': {
    title: 'Política de telemedicina',
    description: 'Alcances, límites y consentimiento de la atención médica a distancia en SabioDoc.',
  },
  '/privacidad': {
    title: 'Política de privacidad',
    description:
      'Cómo SabioDoc trata tus datos personales y de salud: finalidades, encargados, conservación y derechos.',
  },
  '/terminos': {
    title: 'Términos y condiciones',
    description:
      'Reglas de uso de SabioDoc: cuenta, pagos, cancelaciones, responsabilidad y propiedad intelectual.',
  },
  '/doctor/apply': {
    title: 'Postular como médico',
    description:
      'Postúlate como médico en SabioDoc: atiende videoconsultas, recibe resúmenes de pre-consulta con IA y define tu tarifa por minuto.',
  },
}

async function fetchJson(path, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${apiUrl}${path}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function replaceAttr(html, attrPattern, value) {
  const regex = new RegExp(`(<meta\\s+${attrPattern}\\s+content=")[^"]*(")`, 's')
  return html.replace(regex, `$1${escapeHtml(value)}$2`)
}

function imageTypeFromUrl(url) {
  const clean = String(url).split('?')[0].toLowerCase()
  if (clean.endsWith('.png')) return 'image/png'
  if (clean.endsWith('.webp')) return 'image/webp'
  if (clean.endsWith('.gif')) return 'image/gif'
  if (clean.endsWith('.svg')) return 'image/svg+xml'
  return 'image/jpeg'
}

function removeMeta(html, attrPattern) {
  const regex = new RegExp(`\\s*<meta\\s+${attrPattern}[^>]*>`, 'g')
  return html.replace(regex, '')
}

function injectMeta(html, meta) {
  const { title, description, url, image, imageType, imageWidth, imageHeight, imageAlt, jsonLd } = meta
  let out = html
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
  out = replaceAttr(out, 'name="description"', description)
  out = replaceAttr(out, 'property="og:title"', title)
  out = replaceAttr(out, 'property="og:description"', description)
  out = replaceAttr(out, 'property="og:url"', url)
  out = replaceAttr(out, 'name="twitter:title"', title)
  out = replaceAttr(out, 'name="twitter:description"', description)
  if (image) {
    out = replaceAttr(out, 'property="og:image"', image)
    out = replaceAttr(out, 'name="twitter:image"', image)
    if (imageType) out = replaceAttr(out, 'property="og:image:type"', imageType)
    if (imageAlt) out = replaceAttr(out, 'property="og:image:alt"', imageAlt)
    // Solo afirmamos dimensiones cuando son las de la tarjeta social conocida.
    if (imageWidth) out = replaceAttr(out, 'property="og:image:width"', String(imageWidth))
    else out = removeMeta(out, 'property="og:image:width"')
    if (imageHeight) out = replaceAttr(out, 'property="og:image:height"', String(imageHeight))
    else out = removeMeta(out, 'property="og:image:height"')
  }

  if (!/rel="canonical"/.test(out)) {
    out = out.replace('</head>', `    <link rel="canonical" href="${url}" />\n  </head>`)
  } else {
    out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${escapeHtml(url)}$2`)
  }

  if (jsonLd) {
    const payload = Array.isArray(jsonLd) ? jsonLd : [jsonLd]
    const script = `<script type="application/ld+json">${JSON.stringify(payload)}</script>`
    out = out.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
    out = out.replace('</head>', `    ${script}\n  </head>`)
  }
  return out
}

function writePage(baseHtml, routePath, meta) {
  const html = injectMeta(baseHtml, meta)
  const dir = routePath === '/' ? distDir : resolve(distDir, routePath.replace(/^\/+/, ''))
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'index.html'), html)
}

function breadcrumb(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

async function main() {
  if (!existsSync(baseHtmlPath)) {
    console.warn('[meta] no existe dist/index.html; se omite la generación.')
    return
  }
  const baseHtml = readFileSync(baseHtmlPath, 'utf8')

  // Portada: refuerza meta y añade JSON-LD de organización/sitio.
  writePage(baseHtml, '/', {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: `${siteUrl}/`,
    image: DEFAULT_IMAGE,
    imageType: 'image/png',
    imageWidth: 1200,
    imageHeight: 630,
    imageAlt: DEFAULT_IMAGE_ALT,
    jsonLd: SITE_JSONLD,
  })

  for (const [route, meta] of Object.entries(STATIC_META)) {
    writePage(baseHtml, route, {
      ...meta,
      url: `${siteUrl}${route}`,
      image: DEFAULT_IMAGE,
      imageType: 'image/png',
      imageWidth: 1200,
      imageHeight: 630,
      imageAlt: DEFAULT_IMAGE_ALT,
      jsonLd: SITE_JSONLD,
    })
  }

  let specialties = []
  try {
    specialties = (await fetchJson('/specialties')).specialties ?? []
  } catch (error) {
    console.warn(`[meta] API no disponible (${error.message}): solo rutas fijas.`)
    return
  }

  const doctors = new Map()
  for (const specialty of specialties) {
    const url = `${siteUrl}/specialties/${specialty.slug}`
    writePage(baseHtml, `/specialties/${specialty.slug}`, {
      title: `${specialty.name} · SabioDoc`,
      description:
        specialty.description?.slice(0, 300) ||
        `Encuentra especialistas en ${specialty.name} y agenda tu videoconsulta en SabioDoc.`,
      url,
      image: DEFAULT_IMAGE,
      imageType: 'image/png',
      imageWidth: 1200,
      imageHeight: 630,
      imageAlt: DEFAULT_IMAGE_ALT,
      jsonLd: [
        ...SITE_JSONLD,
        {
          '@context': 'https://schema.org',
          '@type': 'MedicalSpecialty',
          name: specialty.name,
          url,
        },
        breadcrumb([
          { name: 'Inicio', url: siteUrl },
          { name: 'Especialidades', url: `${siteUrl}/specialties` },
          { name: specialty.name, url },
        ]),
      ],
    })
    try {
      const data = await fetchJson(`/doctors/specialty/${specialty.slug}`)
      for (const doctor of data.doctors ?? []) {
        if (!doctors.has(doctor.id)) doctors.set(doctor.id, doctor)
      }
    } catch (error) {
      console.warn(`[meta] sin médicos para ${specialty.slug}: ${error.message}`)
    }
  }

  for (const [id, doctor] of doctors) {
    const description =
      [doctor.professional_title, doctor.bio_short].filter(Boolean).join(' — ').slice(0, 300) ||
      `Perfil del médico ${doctor.display_name} en SabioDoc.`
    const url = `${siteUrl}/doctors/${id}`
    const hasPhoto = Boolean(doctor.photo_url)
    const image = hasPhoto ? doctor.photo_url : DEFAULT_IMAGE
    writePage(baseHtml, `/doctors/${id}`, {
      title: `${doctor.display_name} · SabioDoc`,
      description,
      url,
      image,
      // Si es la foto del médico, no afirmamos dimensiones/alt genéricos.
      imageType: hasPhoto ? imageTypeFromUrl(image) : 'image/png',
      imageWidth: hasPhoto ? undefined : 1200,
      imageHeight: hasPhoto ? undefined : 630,
      imageAlt: hasPhoto ? `Foto de ${doctor.display_name}` : DEFAULT_IMAGE_ALT,
      jsonLd: [
        ...SITE_JSONLD,
        {
          '@context': 'https://schema.org',
          '@type': 'Physician',
          name: doctor.display_name,
          medicalSpecialty: doctor.professional_title || undefined,
          image: hasPhoto ? doctor.photo_url : undefined,
          url,
        },
        breadcrumb([
          { name: 'Inicio', url: siteUrl },
          { name: 'Especialidades', url: `${siteUrl}/specialties` },
          { name: doctor.display_name, url },
        ]),
      ],
    })
  }

  console.log(
    `[meta] generadas ${Object.keys(STATIC_META).length} rutas fijas, ${specialties.length} especialidades y ${doctors.size} médicos.`,
  )
}

main().catch((error) => {
  console.warn(`[meta] error inesperado: ${error.message}`)
})
