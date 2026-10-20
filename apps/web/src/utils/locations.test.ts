import { describe, expect, it } from 'vitest'

import { localizedCountryName, sortCountries } from './locations'

describe('localizedCountryName', () => {
  it('traduce códigos ISO al español', () => {
    expect(localizedCountryName('PE')).toBe('Perú')
    expect(localizedCountryName('CO')).toBe('Colombia')
    expect(localizedCountryName('US')).toBe('Estados Unidos')
  })

  it('usa el fallback cuando no hay código', () => {
    expect(localizedCountryName('', 'Peru')).toBe('Peru')
  })
})


describe('sortCountries', () => {
  it('prioriza Perú y la operación antes del resto', () => {
    const sorted = sortCountries([
      { isoCode: 'US', name: 'United States' },
      { isoCode: 'AR', name: 'Argentina' },
      { isoCode: 'PE', name: 'Peru' },
    ])

    expect(sorted.map((country) => country.isoCode)).toEqual(['PE', 'AR', 'US'])
  })
})
