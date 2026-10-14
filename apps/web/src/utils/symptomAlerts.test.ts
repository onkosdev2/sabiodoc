import { describe, expect, it } from 'vitest'

import { detectAlarmSymptoms } from './symptomAlerts'
import { EMERGENCY_BY_COUNTRY, getEmergencyCountry } from './emergencyNumbers'

describe('detectAlarmSymptoms', () => {
  it('detecta signos de alarma clínicos', () => {
    expect(detectAlarmSymptoms('Tengo dolor en el pecho desde ayer')).toContain(
      'Dolor o presión en el pecho',
    )
    expect(detectAlarmSymptoms('presión en el pecho')).toContain('Dolor o presión en el pecho')
    expect(detectAlarmSymptoms('tengo dificultad para respirar')).toContain(
      'Dificultad para respirar',
    )
    expect(detectAlarmSymptoms('sangrado abundante que no se detiene')).toContain(
      'Sangrado abundante',
    )
    expect(detectAlarmSymptoms('creo que es un derrame cerebral')).toContain(
      'Signos neurológicos (posible derrame/ACV)',
    )
  })

  it('ignora búsquedas normales', () => {
    expect(detectAlarmSymptoms('cardiólogo')).toEqual([])
    expect(detectAlarmSymptoms('dermatología')).toEqual([])
    expect(detectAlarmSymptoms('')).toEqual([])
  })
})

describe('emergencyNumbers', () => {
  it('Perú usa las líneas oficiales y no 911 como único número', () => {
    const peru = getEmergencyCountry('PE')
    expect(peru).not.toBeNull()
    const tels = peru!.numbers.map((item) => item.tel)
    expect(tels).toContain('106')
    expect(tels).toContain('116')
    expect(tels).toContain('105')
    expect(tels).not.toEqual(['911'])
    expect(peru!.note).toMatch(/911/i)
  })

  it('devuelve null para un país no incluido (fallback)', () => {
    expect(getEmergencyCountry('ZZ')).toBeNull()
    expect(Object.keys(EMERGENCY_BY_COUNTRY).length).toBeGreaterThan(0)
  })
})
