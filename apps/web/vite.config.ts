import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const DEFAULT_SITE_URL = 'https://sabiodoc.app'

/** Assets de `public/` que conviene tener disponibles sin conexión. */
const PRECACHE_PUBLIC_FILES = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
]

/**
 * Reemplaza `%SITE_URL%` en `index.html` y en los archivos de `public/`
 * (robots.txt, sitemap.xml) por la URL del sitio definida en `VITE_SITE_URL`.
 */
function siteUrlPlugin(siteUrl: string): Plugin {
  let outDir = 'dist'

  return {
    name: 'sabiodoc-site-url',
    configResolved(config) {
      outDir = config.build.outDir
    },
    transformIndexHtml(html) {
      return html.replaceAll('%SITE_URL%', siteUrl)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (!url || (url !== '/robots.txt' && url !== '/sitemap.xml')) return next()

        const filePath = resolve(server.config.publicDir, url.slice(1))
        if (!existsSync(filePath)) return next()

        res.setHeader('Content-Type', url.endsWith('.xml') ? 'application/xml' : 'text/plain')
        res.end(readFileSync(filePath, 'utf8').replaceAll('%SITE_URL%', siteUrl))
      })
    },
    closeBundle() {
      for (const file of ['robots.txt', 'sitemap.xml']) {
        const filePath = resolve(outDir, file)
        if (!existsSync(filePath)) continue
        const content = readFileSync(filePath, 'utf8').replaceAll('%SITE_URL%', siteUrl)
        writeFileSync(filePath, content)
      }
    },
  }
}

/**
 * Genera `sw.js` (service worker) inyectando en la plantilla la lista de assets
 * del build para precachearlos y permitir el modo offline.
 */
function serviceWorkerPlugin(): Plugin {
  let root = process.cwd()
  let outDir = 'dist'
  let bundleFiles: string[] = []

  return {
    name: 'sabiodoc-service-worker',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = config.build.outDir
    },
    generateBundle(_options, bundle) {
      bundleFiles = Object.keys(bundle).filter((file) => !file.endsWith('.map'))
    },
    closeBundle() {
      const templatePath = resolve(root, 'scripts/sw-template.js')
      if (!existsSync(templatePath)) return

      const precache = Array.from(
        new Set(['/', '/index.html', ...bundleFiles.map((file) => `/${file}`), ...PRECACHE_PUBLIC_FILES]),
      )
      const serviceWorker = readFileSync(templatePath, 'utf8').replace(
        '__PRECACHE_MANIFEST__',
        JSON.stringify(precache),
      )
      writeFileSync(resolve(outDir, 'sw.js'), serviceWorker)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const siteUrl = (env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '')

  return {
    plugins: [react(), siteUrlPlugin(siteUrl), serviceWorkerPlugin()],
    server: {
      port: 5173,
      host: true,
    },
  }
})
