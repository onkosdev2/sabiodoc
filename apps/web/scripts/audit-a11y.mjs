/**
 * Auditoría de accesibilidad con axe-core sobre Chromium.
 *
 * Uso:
 *   SITE_URL=https://sabiodoc-1.onrender.com npm run audit:a11y
 *   CHROME_PATH=/snap/bin/chromium npm run audit:a11y
 *
 * Guarda evidencia en docs/evidencias/AAAA-MM-DD/accesibilidad-axe.md
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import puppeteer from 'puppeteer-core'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const siteUrl = (process.env.SITE_URL || 'https://sabiodoc-1.onrender.com').replace(/\/+$/, '')
const apiUrl = (process.env.API_URL || 'https://sabiodoc.onrender.com').replace(/\/+$/, '')
const outDir = resolve(repoRoot, 'docs', 'evidencias', new Date().toISOString().slice(0, 10))
const viewportWidth = Number(process.env.VIEWPORT_WIDTH || 1440)
const viewportHeight = Number(process.env.VIEWPORT_HEIGHT || 900)
const viewportSuffix = viewportWidth < 768 ? 'mobile' : 'desktop'
const authEmail = process.env.A11Y_EMAIL
const authPassword = process.env.A11Y_PASSWORD
const authLabel = process.env.A11Y_LABEL || (authEmail ? 'auth' : 'public')
const axeSource = readFileSync(resolve(here, '../node_modules/axe-core/axe.min.js'), 'utf8')
const strict = process.argv.includes('--strict')

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/snap/bin/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter(Boolean)
const executablePath = CHROME_CANDIDATES.find((path) => existsSync(path))
if (!executablePath) {
  console.error('No se encontró Chromium. Define CHROME_PATH.')
  process.exit(2)
}

const publicRoutes = [
  '/',
  '/como-funciona/',
  '/specialties/',
  '/specialties/cardiologia/',
  '/doctors/2/',
  '/triage/',
  '/guide/',
  '/emergency/',
  '/privacidad/',
  '/terminos/',
  '/telemedicina/',
  '/login/',
  '/register/',
  '/forgot-password/',
  '/doctor/apply/',
]

const authenticatedRoutes = [
  '/me/profile/',
  '/me/appointments/',
  '/me/wallet/',
  '/notifications/',
]

const routes = process.env.A11Y_ROUTES
  ? process.env.A11Y_ROUTES.split(',').map((route) => route.trim()).filter(Boolean)
  : authEmail
    ? authenticatedRoutes
    : publicRoutes

let authToken = null
if (authEmail && authPassword) {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: authEmail, password: authPassword }),
  })
  if (!response.ok) {
    console.error(`No se pudo iniciar sesión para la auditoría: HTTP ${response.status}`)
    process.exit(2)
  }
  const data = await response.json()
  authToken = data.access_token
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
})

const results = []
try {
  const page = await browser.newPage()
  await page.setViewport({ width: viewportWidth, height: viewportHeight })
  if (authToken) {
    await page.evaluateOnNewDocument((token) => {
      localStorage.setItem('token', token)
    }, authToken)
  }

  for (const route of routes) {
    const url = `${siteUrl}${route}`
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await new Promise((resolve) => setTimeout(resolve, 1200))
      await page.addScriptTag({ content: axeSource })
      const report = await page.evaluate(async () => {
        return await window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
          },
        })
      })
      results.push({ route, url, violations: report.violations, passes: report.passes.length })
      console.log(`${route}: ${report.violations.length} violaciones`)
    } catch (error) {
      results.push({ route, url, error: error.message, violations: [] })
      console.error(`${route}: error ${error.message}`)
    }
  }
} finally {
  await browser.close()
}

const totalViolations = results.reduce((sum, item) => sum + item.violations.length, 0)
const serious = results.flatMap((item) =>
  item.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact)),
)

const lines = [
  '# Auditoría de accesibilidad — axe-core',
  '',
  `- **Sitio:** ${siteUrl}`,
  `- **Fecha:** ${new Date().toISOString()}`,
  `- **Navegador:** ${executablePath}`,
  `- **Viewport:** ${viewportWidth}×${viewportHeight}`,
  `- **Sesión:** ${authLabel}`,
  `- **Reglas:** WCAG 2.0/2.1/2.2 A y AA`,
  `- **Violaciones totales:** ${totalViolations}`,
  `- **Violaciones serias/críticas:** ${serious.length}`,
  '',
  '| Ruta | Violaciones | Detalle |',
  '|---|---:|---|',
  ...results.map((item) => {
    if (item.error) return `| \`${item.route}\` | — | Error: ${item.error} |`
    const ids = item.violations.map((violation) => violation.id).join(', ')
    return `| \`${item.route}\` | ${item.violations.length} | ${ids || 'Sin violaciones'} |`
  }),
  '',
  '## Detalle',
  '',
]

for (const item of results) {
  if (!item.violations.length) continue
  lines.push(`### ${item.route}`, '')
  for (const violation of item.violations) {
    lines.push(
      `- **${violation.id}** (${violation.impact}): ${violation.help}`,
      `  - ${violation.nodes.length} elemento(s): ${violation.nodes
        .slice(0, 5)
        .map((node) => node.target.join(' '))
        .join(' | ')}`,
    )
  }
  lines.push('')
}

mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, `accesibilidad-axe-${authLabel}-${viewportSuffix}.md`), lines.join('\n'))
writeFileSync(resolve(outDir, `accesibilidad-axe-${authLabel}-${viewportSuffix}.json`), JSON.stringify({ siteUrl, viewportWidth, viewportHeight, results }, null, 2))

console.log(`Evidencia: ${outDir}`)
console.log(`Total: ${totalViolations} violaciones; ${serious.length} serias/críticas.`)
if (strict && serious.length > 0) process.exit(1)
