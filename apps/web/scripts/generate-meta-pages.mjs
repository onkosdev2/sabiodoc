/**
 * Genera copias de `dist/index.html` con las meta etiquetas (title, description,
 * Open Graph, Twitter y canonical) ya inyectadas para las rutas públicas:
 * fijas + especialidades + perfiles de médicos.
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

function injectMeta(html, { title, description, url, image }) {
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
  }
  if (!/rel="canonical"/.test(out)) {
    out = out.replace('</head>', `    <link rel="canonical" href="${url}" />\n  </head>`)
  } else {
    out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
  }
  return out
}

function writePage(baseHtml, routePath, meta) {
  const html = injectMeta(baseHtml, meta)
  const dir =
    routePath === '/' ? distDir : resolve(distDir, routePath.replace(/^\/+/, ''))
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'index.html'), html)
}

async function main() {
  if (!existsSync(baseHtmlPath)) {
    console.warn('[meta] no existe dist/index.html; se omite la generación.')
    return
  }
  const baseHtml = readFileSync(baseHtmlPath, 'utf8')

  for (const [route, meta] of Object.entries(STATIC_META)) {
    writePage(baseHtml, route, {
      ...meta,
      url: `${siteUrl}${route}`,
      image: `${siteUrl}/og-image.png`,
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
    writePage(baseHtml, `/specialties/${specialty.slug}`, {
      title: `${specialty.name} · SabioDoc`,
      description:
        specialty.description?.slice(0, 300) ||
        `Encuentra especialistas en ${specialty.name} y agenda tu videoconsulta en SabioDoc.`,
      url: `${siteUrl}/specialties/${specialty.slug}`,
      image: `${siteUrl}/og-image.png`,
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
    writePage(baseHtml, `/doctors/${id}`, {
      title: `${doctor.display_name} · SabioDoc`,
      description,
      url: `${siteUrl}/doctors/${id}`,
      image: doctor.photo_url || `${siteUrl}/og-image.png`,
    })
  }

  console.log(
    `[meta] generadas ${Object.keys(STATIC_META).length} rutas fijas, ${specialties.length} especialidades y ${doctors.size} médicos.`,
  )
}

main().catch((error) => {
  console.warn(`[meta] error inesperado: ${error.message}`)
})
