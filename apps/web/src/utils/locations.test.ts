import { describe, expect, it } from 'vitest'

import { localizedCountryName } from './locations'

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
