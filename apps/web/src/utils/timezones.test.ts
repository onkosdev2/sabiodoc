import { describe, expect, it } from 'vitest'

import { getTimeZoneOptions, timeZoneLabel } from './format'

describe('timeZoneLabel', () => {
  it('muestra Lima con offset en formato UTC', () => {
    const label = timeZoneLabel('America/Lima', new Date('2026-10-19T12:00:00Z'))
    expect(label).toContain('Lima')
    expect(label).toContain('UTC')
    expect(label).not.toContain('GMT')
  })

  it('usa nombres legibles para ciudades conocidas', () => {
    expect(timeZoneLabel('America/Mexico_City')).toContain('Ciudad de México')
    expect(timeZoneLabel('America/Bogota')).toContain('Bogotá')
  })
})

describe('getTimeZoneOptions', () => {
  it('prioriza Perú y elimina duplicados', () => {
    const options = getTimeZoneOptions()
    expect(options[0]).toBe('America/Lima')
    expect(options).toContain('America/Bogota')
    expect(new Set(options).size).toBe(options.length)
  })
})
