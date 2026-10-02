/**
 * Genera `dist/sitemap.xml` con las URLs públicas reales del sitio:
 * páginas fijas + especialidades + perfiles de médicos aprobados.
 *
 * Se ejecuta en `postbuild` (ver package.json). Consulta la API con
 * `VITE_API_URL`; si no está disponible, conserva el sitemap estático que ya
 * quedó copiado en `dist/` desde `public/` y no rompe el build.
 *
 * Uso:
 *   node scripts/generate-sitemap.mjs
 *   VITE_API_URL=https://api.sabiodoc.app VITE_SITE_URL=https://sabiodoc.app node scripts/generate-sitemap.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')

function loadEnvFile(file) {
  if (!existsSync(file)) return {}
  const env = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
  }
  return env
}

const fileEnv = { ...loadEnvFile(resolve(projectRoot, '.env')), ...loadEnvFile(resolve(projectRoot, '.env.local')) }
const apiUrl = (process.env.VITE_API_URL || fileEnv.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')
const siteUrl = (process.env.VITE_SITE_URL || fileEnv.VITE_SITE_URL || 'https://sabiodoc.app').replace(/\/+$/, '')
const outFile = resolve(projectRoot, 'dist', 'sitemap.xml')

const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/como-funciona', changefreq: 'monthly', priority: '0.8' },
  { path: '/specialties', changefreq: 'weekly', priority: '0.9' },
  { path: '/triage', changefreq: 'monthly', priority: '0.6' },
  { path: '/guide', changefreq: 'monthly', priority: '0.6' },
  { path: '/emergency', changefreq: 'yearly', priority: '0.4' },
  { path: '/doctor/apply', changefreq: 'monthly', priority: '0.7' },
]

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

function buildXml(entries) {
  const urls = entries
    .map(
      (entry) =>
        `  <url>\n` +
        `    <loc>${siteUrl}${entry.path}</loc>\n` +
        (entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>\n` : '') +
        (entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>\n` : '') +
        (entry.priority ? `    <priority>${entry.priority}</priority>\n` : '') +
        `  </url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

function fallback() {
  // Si la API no responde, generamos al menos las rutas fijas (incluye /como-funciona).
  writeFileSync(outFile, buildXml(STATIC_ROUTES))
  console.warn('[sitemap] API no disponible: se generó solo con las rutas fijas.')
}

async function main() {
  let specialties = []
  try {
    const data = await fetchJson('/specialties')
    specialties = data.specialties ?? []
  } catch (error) {
    console.warn(`[sitemap] no se pudieron obtener especialidades: ${error.message}`)
    fallback()
    return
  }

  const entries = [...STATIC_ROUTES]
  const doctorIds = new Set()

  for (const specialty of specialties) {
    entries.push({
      path: `/specialties/${specialty.slug}`,
      changefreq: 'weekly',
      priority: '0.8',
    })
    try {
      const doctors = await fetchJson(`/doctors/specialty/${specialty.slug}`)
      for (const doctor of doctors.doctors ?? []) doctorIds.add(doctor.id)
    } catch (error) {
      console.warn(`[sitemap] sin médicos para ${specialty.slug}: ${error.message}`)
    }
  }

  for (const doctorId of doctorIds) {
    entries.push({ path: `/doctors/${doctorId}`, changefreq: 'weekly', priority: '0.6' })
  }

  writeFileSync(outFile, buildXml(entries))
  console.log(
    `[sitemap] generado con ${entries.length} URLs (${specialties.length} especialidades, ${doctorIds.size} médicos).`,
  )
}

main().catch((error) => {
  console.warn(`[sitemap] error inesperado: ${error.message}`)
  fallback()
})
