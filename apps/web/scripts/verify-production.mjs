/**
 * Verificación de producción de SabioDoc.
 *
 * Comprueba que el sitio desplegado sirve el HTML, las cabeceras, el manifest
 * y los códigos de estado que el repositorio espera. No sustituye una prueba
 * manual en navegador: es la red de seguridad para detectar diferencias entre
 * el build y el hosting.
 *
 * Uso:
 *   node scripts/verify-production.mjs
 *   SITE_URL=https://sabiodoc-1.onrender.com API_URL=https://sabiodoc.onrender.com node scripts/verify-production.mjs
 *   node scripts/verify-production.mjs --strict
 *
 * `--strict` también falla con advertencias (por ejemplo, datos de prueba
 * publicados). Úsalo antes de pasar a producción real.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const siteUrl = (process.env.SITE_URL || 'https://sabiodoc-1.onrender.com').replace(/\/+$/, '')
const apiUrl = (process.env.API_URL || 'https://sabiodoc.onrender.com').replace(/\/+$/, '')
const strict = process.argv.includes('--strict')
const outDir = resolve(repoRoot, 'docs', 'evidencias', new Date().toISOString().slice(0, 10))

const results = []
const add = (id, label, status, detail, critical = false) => {
  results.push({ id, label, status, detail, critical })
}

async function request(url, options = {}) {
  const { follow = false, ...fetchOptions } = options
  try {
    const response = await fetch(url, {
      redirect: follow ? 'follow' : 'manual',
      signal: AbortSignal.timeout(20_000),
      headers: { 'user-agent': 'SabioDoc-Verify/1.0' },
      ...fetchOptions,
    })
    const body = await response.text()
    return { ok: true, status: response.status, headers: response.headers, body }
  } catch (error) {
    return { ok: false, error: error.message, status: 0, headers: new Headers(), body: '' }
  }
}

function meta(html, pattern) {
  const match = html.match(pattern)
  return match ? match[1].trim() : ''
}

function titleOf(html) {
  return meta(html, /<title>([\s\S]*?)<\/title>/i)
}

function canonicalOf(html) {
  return meta(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i)
}

function ogUrlOf(html) {
  return meta(html, /<meta\s+property="og:url"\s+content="([^"]*)"/i)
}

function robotsOf(html) {
  return meta(html, /<meta\s+name="robots"\s+content="([^"]*)"/i)
}

function expectedPublicUrl(path) {
  if (path === '/') return `${siteUrl}/`
  return `${siteUrl}${path.replace(/\/+$/, '')}/`
}

const pages = [
  { path: '/', expectedTitle: 'SabioDoc', canonical: '/' },
  { path: '/como-funciona', expectedRedirect: true },
  { path: '/como-funciona/', expectedTitle: 'Cómo funciona SabioDoc', canonical: '/como-funciona/' },
  { path: '/specialties', expectedRedirect: true },
  { path: '/specialties/', expectedTitle: 'Especialidades', canonical: '/specialties/' },
  { path: '/specialties/cardiologia/', expectedTitle: 'Cardiología', canonical: '/specialties/cardiologia/' },
  { path: '/privacidad', expectedRedirect: true },
  { path: '/privacidad/', expectedTitle: 'Política de privacidad', canonical: '/privacidad/' },
  { path: '/emergency', expectedRedirect: true },
  { path: '/emergency/', expectedTitle: 'Emergencias', canonical: '/emergency/' },
  { path: '/doctor/apply', expectedRedirect: true },
  { path: '/doctor/apply/', expectedTitle: 'Postular', canonical: '/doctor/apply/' },
]

async function checkPages() {
  for (const page of pages) {
    const res = await request(`${siteUrl}${page.path}`)
    const expectedStatus = page.expectedRedirect ? 301 : 200
    const statusOk = res.status === expectedStatus
    add(
      `page:${page.path}`,
      `${page.path} responde ${expectedStatus}`,
      statusOk ? 'PASS' : 'FAIL',
      `HTTP ${res.status}${res.headers.get('location') ? ` → ${res.headers.get('location')}` : ''}`,
      false,
    )
    if (!res.ok || page.expectedRedirect) continue

    const title = titleOf(res.body)
    const canonical = canonicalOf(res.body)
    const ogUrl = ogUrlOf(res.body)
    const robots = robotsOf(res.body)
    const expectedCanonical = expectedPublicUrl(page.canonical || page.path)

    add(
      `title:${page.path}`,
      `${page.path} tiene el título esperado`,
      title.toLowerCase().includes(page.expectedTitle.toLowerCase()) ? 'PASS' : 'FAIL',
      `“${title || '(vacío)'}”`,
    )
    add(
      `canonical:${page.path}`,
      `${page.path} canonical coincide con la URL servida`,
      canonical === expectedCanonical ? 'PASS' : 'FAIL',
      `canonical=${canonical || '(vacío)'} esperado=${expectedCanonical}`,
      true,
    )
    add(
      `og:${page.path}`,
      `${page.path} og:url coincide con la URL servida`,
      ogUrl === expectedCanonical ? 'PASS' : 'FAIL',
      `og:url=${ogUrl || '(vacío)'} esperado=${expectedCanonical}`,
    )
    add(
      `robots:${page.path}`,
      `${page.path} es indexable`,
      /index/i.test(robots) && !/noindex/i.test(robots) ? 'PASS' : 'FAIL',
      `robots=${robots || '(vacío)'}`,
    )
  }
}

async function check404() {
  const paths = [
    '/ruta-inexistente-auditoria',
    '/specialties/slug-que-no-existe',
    '/doctors/999999',
  ]
  for (const path of paths) {
    const res = await request(`${siteUrl}${path}`, { follow: true })
    const robots = robotsOf(res.body)
    const is404 = res.status === 404
    const isNoindex = /noindex/i.test(robots)
    add(
      `404:${path}`,
      `${path} devuelve 404 o noindex real`,
      is404 || isNoindex ? 'PASS' : 'FAIL',
      `HTTP ${res.status}; robots=${robots || '(vacío)'}`,
      true,
    )
  }
}

async function checkHeaders() {
  const home = await request(`${siteUrl}/`)
  const headers = home.headers
  const required = [
    ['content-security-policy', /default-src|frame-ancestors/i],
    ['referrer-policy', /strict-origin-when-cross-origin|no-referrer/i],
    ['permissions-policy', /camera|microphone/i],
  ]
  for (const [name, pattern] of required) {
    const value = headers.get(name) || headers.get(`${name}-report-only`) || ''
    add(`header:${name}`, `Cabecera ${name} presente`, pattern.test(value) ? 'PASS' : 'FAIL', value || '(ausente)')
  }
  const enforcingCsp = headers.get('content-security-policy') || ''
  add(
    'header:csp-enforcing',
    'CSP está en modo bloqueo (no solo Report-Only)',
    enforcingCsp ? 'PASS' : 'FAIL',
    enforcingCsp ? 'Content-Security-Policy presente' : 'Solo Report-Only o ausente',
  )

  const frame = headers.get('x-frame-options') || ''
  const csp = enforcingCsp || headers.get('content-security-policy-report-only') || ''
  add(
    'header:framing',
    'Protección de framing presente',
    /deny|sameorigin/i.test(frame) || /frame-ancestors/i.test(csp) ? 'PASS' : 'FAIL',
    frame || csp || '(ausente)',
  )

  const htmlCache = headers.get('cache-control') || ''
  add(
    'cache:html',
    'HTML no se cachea como inmutable',
    !/immutable/i.test(htmlCache) ? 'PASS' : 'FAIL',
    htmlCache || '(ausente)',
  )

  const assetMatch = home.body.match(/src="(\/assets\/[^"]+\.js)"/)
  if (assetMatch) {
    const asset = await request(`${siteUrl}${assetMatch[1]}`)
    const cache = asset.headers.get('cache-control') || ''
    add(
      'cache:asset',
      'Assets con hash usan caché inmutable',
      /immutable/i.test(cache) && /max-age=31536000/.test(cache) ? 'PASS' : 'FAIL',
      cache || '(ausente)',
      true,
    )
  } else {
    add('cache:asset', 'Assets con hash usan caché inmutable', 'FAIL', 'No se encontró un asset JS en el HTML')
  }

  const manifest = await request(`${siteUrl}/manifest.webmanifest`)
  const contentType = manifest.headers.get('content-type') || ''
  add(
    'manifest:mime',
    'manifest.webmanifest se sirve como application/manifest+json',
    /application\/manifest\+json/i.test(contentType) ? 'PASS' : 'FAIL',
    contentType || '(ausente)',
  )
}

async function checkSitemap() {
  const sitemap = await request(`${siteUrl}/sitemap.xml`)
  if (sitemap.status !== 200) {
    add('sitemap', 'Sitemap accesible', 'FAIL', `HTTP ${sitemap.status}`)
    return
  }
  const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  add('sitemap', 'Sitemap accesible', 'PASS', `${locs.length} URLs`)

  const withoutSlash = locs.filter((loc) => {
    const path = new URL(loc).pathname
    return path !== '/' && !path.endsWith('/')
  })
  add(
    'sitemap:slash',
    'Todas las URLs del sitemap usan la forma canónica con barra final',
    withoutSlash.length === 0 ? 'PASS' : 'FAIL',
    withoutSlash.length ? `${withoutSlash.length} sin barra: ${withoutSlash.slice(0, 5).join(', ')}` : 'ok',
    true,
  )

  const sample = locs.slice(0, 12)
  for (const loc of sample) {
    const res = await request(loc, { follow: true })
    const canonical = canonicalOf(res.body)
    add(
      `sitemap:url:${new URL(loc).pathname}`,
      `${new URL(loc).pathname} responde 200 y canonical coincide`,
      res.status === 200 && canonical === loc ? 'PASS' : 'FAIL',
      `HTTP ${res.status}; canonical=${canonical || '(vacío)'}`,
    )
  }
}

async function checkApiAndData() {
  const specialties = await request(`${apiUrl}/specialties`)
  add(
    'api:specialties',
    'API de especialidades responde',
    specialties.status === 200 ? 'PASS' : 'FAIL',
    `HTTP ${specialties.status}`,
  )

  const cardiology = await request(`${apiUrl}/doctors/specialty/cardiologia`)
  let doctors = []
  try {
    doctors = JSON.parse(cardiology.body).doctors ?? []
  } catch {
    add('api:doctors', 'API de médicos responde JSON', 'FAIL', 'Respuesta no JSON')
    return
  }
  const testDoctors = doctors.filter((doctor) => /test|demo|qa|example/i.test(doctor.display_name || ''))
  add(
    'data:test-doctors',
    'No hay médicos de prueba publicados en Cardiología',
    testDoctors.length === 0 ? 'PASS' : 'WARN',
    testDoctors.length
      ? `${testDoctors.map((d) => `${d.id}:${d.display_name}`).join(', ')} — aceptado temporalmente para testeo; retirar antes de producción real`
      : 'ok',
    false,
  )
}

function renderMarkdown() {
  const failed = results.filter((r) => r.status === 'FAIL')
  const criticalFailed = failed.filter((r) => r.critical)
  const warnings = results.filter((r) => r.status === 'WARN')
  const lines = [
    '# Verificación de producción — SabioDoc',
    '',
    `- **Sitio:** ${siteUrl}`,
    `- **API:** ${apiUrl}`,
    `- **Fecha:** ${new Date().toISOString()}`,
    `- **Resultado:** ${results.length - failed.length}/${results.length} comprobaciones OK`,
    `- **Fallos críticos:** ${criticalFailed.length}`,
    `- **Advertencias:** ${warnings.length}`,
    '',
    '| ID | Comprobación | Resultado | Detalle |',
    '|---|---|---|---|',
    ...results.map((r) => `| \`${r.id}\` | ${r.label} | ${r.status === 'PASS' ? '✅ PASS' : r.status === 'WARN' ? '⚠️ WARN' : '❌ FAIL'} | ${String(r.detail).replace(/\|/g, '\\|')} |`),
    '',
    '## Fallos críticos',
    '',
    ...(criticalFailed.length
      ? criticalFailed.map((r) => `- **${r.id}:** ${r.label} — ${r.detail}`)
      : ['Sin fallos críticos.']),
    '',
    '## Advertencias',
    '',
    ...(warnings.length
      ? warnings.map((r) => `- **${r.id}:** ${r.label} — ${r.detail}`)
      : ['Sin advertencias.']),
    '',
  ]
  return lines.join('\n')
}

await checkPages()
await check404()
await checkHeaders()
await checkSitemap()
await checkApiAndData()

mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'verificacion-produccion.md'), renderMarkdown())
writeFileSync(resolve(outDir, 'verificacion-produccion.json'), JSON.stringify({ siteUrl, apiUrl, results }, null, 2))

const failed = results.filter((r) => r.status === 'FAIL')
const criticalFailed = failed.filter((r) => r.critical)
const warnings = results.filter((r) => r.status === 'WARN')
console.log(
  `Verificación: ${results.length - failed.length - warnings.length}/${results.length} OK; ${criticalFailed.length} fallos críticos; ${warnings.length} advertencias.`,
)
console.log(`Evidencia: ${outDir}`)
for (const item of failed.slice(0, 20)) console.log(`- ${item.id}: ${item.detail}`)
for (const item of warnings) console.log(`! ${item.id}: ${item.detail}`)
if (strict && (criticalFailed.length > 0 || warnings.length > 0)) process.exit(1)
