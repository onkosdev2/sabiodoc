/**
 * Genera un archivo JSON por país con la lista de nombres de ciudades.
 *
 * El dataset original de `country-state-city` pesa ~8 MB y se cargaba entero
 * para cualquier país. Aquí lo dividimos por país y guardamos solo los nombres
 * (que es lo único que usa la UI), de modo que el frontend pida únicamente el
 * país seleccionado. Ej.: Perú pesa ~8 KB.
 *
 * Se ejecuta antes de `dev` y `build` (ver package.json) y escribe en
 * `public/cities/<ISO>.json`, carpeta que está ignorada por git.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const sourceFile = resolve(projectRoot, 'node_modules/country-state-city/lib/assets/city.json')
const outputDir = resolve(projectRoot, 'public/cities')

const rawCities = JSON.parse(readFileSync(sourceFile, 'utf8'))

/** @type {Map<string, Set<string>>} */
const citiesByCountry = new Map()
for (const row of rawCities) {
  const name = row[0]
  const countryCode = row[1]
  if (!countryCode || !name) continue
  if (!citiesByCountry.has(countryCode)) citiesByCountry.set(countryCode, new Set())
  citiesByCountry.get(countryCode).add(name)
}

rmSync(outputDir, { recursive: true, force: true })
mkdirSync(outputDir, { recursive: true })

let totalBytes = 0
for (const [countryCode, names] of citiesByCountry) {
  const sorted = Array.from(names).sort((a, b) => a.localeCompare(b, 'es'))
  const payload = JSON.stringify(sorted)
  writeFileSync(resolve(outputDir, `${countryCode}.json`), payload)
  totalBytes += Buffer.byteLength(payload)
}

console.log(
  `[cities] ${citiesByCountry.size} archivos generados en public/cities (${(totalBytes / 1024).toFixed(0)} KB en total)`,
)
