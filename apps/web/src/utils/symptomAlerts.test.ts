import { describe, expect, it } from 'vitest'

import { detectAlarmSymptoms } from './symptomAlerts'
import {
  EMERGENCY_BY_COUNTRY,
  EMERGENCY_LAST_REVIEWED,
  getEmergencyCountry,
} from './emergencyNumbers'

describe('detectAlarmSymptoms', () => {
  it('detecta dolor o presión en el pecho', () => {
    expect(detectAlarmSymptoms('Tengo dolor en el pecho desde ayer')).toContain(
      'Dolor o presión en el pecho',
    )
    expect(detectAlarmSymptoms('presión en el pecho')).toContain('Dolor o presión en el pecho')
    expect(detectAlarmSymptoms('opresión torácica')).toContain('Dolor o presión en el pecho')
    expect(detectAlarmSymptoms('creo que es un infarto')).toContain('Dolor o presión en el pecho')
  })

  it('detecta dificultad para respirar', () => {
    expect(detectAlarmSymptoms('tengo dificultad para respirar')).toContain(
      'Dificultad para respirar',
    )
    expect(detectAlarmSymptoms('no puedo respirar')).toContain('Dificultad para respirar')
    expect(detectAlarmSymptoms('me falta el aire')).toContain('Dificultad para respirar')
  })

  it('detecta signos neurológicos y pérdida de conciencia', () => {
    expect(detectAlarmSymptoms('creo que es un derrame cerebral')).toContain(
      'Signos neurológicos (posible derrame/ACV)',
    )
    expect(detectAlarmSymptoms('se me tuerce la boca')).toContain(
      'Signos neurológicos (posible derrame/ACV)',
    )
    expect(detectAlarmSymptoms('tuve convulsiones')).toContain(
      'Signos neurológicos (posible derrame/ACV)',
    )
    expect(detectAlarmSymptoms('perdi el conocimiento')).toContain(
      'Signos neurológicos (posible derrame/ACV)',
    )
  })

  it('detecta sangrado abundante y vómito con sangre', () => {
    expect(detectAlarmSymptoms('sangrado abundante que no se detiene')).toContain(
      'Sangrado abundante',
    )
    expect(detectAlarmSymptoms('vómito con sangre')).toContain('Sangrado abundante')
  })

  it('detecta reacción alérgica grave', () => {
    expect(detectAlarmSymptoms('creo que tengo anafilaxia')).toContain(
      'Reacción alérgica grave',
    )
    expect(detectAlarmSymptoms('se me cierra la garganta')).toContain(
      'Reacción alérgica grave',
    )
    expect(detectAlarmSymptoms('tengo los labios hinchados')).toContain(
      'Reacción alérgica grave',
    )
  })

  it('detecta intoxicación, riesgo suicida y alarma en el embarazo', () => {
    expect(detectAlarmSymptoms('creo que es una sobredosis')).toContain(
      'Intoxicación o sobredosis',
    )
    expect(detectAlarmSymptoms('quiero morir')).toContain('Riesgo para la propia vida')
    expect(detectAlarmSymptoms('embarazo con sangrado vaginal')).toContain(
      'Embarazo con signos de alarma',
    )
  })

  it('devuelve varias banderas cuando el texto contiene varios signos', () => {
    const flags = detectAlarmSymptoms('dolor en el pecho y dificultad para respirar')
    expect(flags).toContain('Dolor o presión en el pecho')
    expect(flags).toContain('Dificultad para respirar')
  })

  it('ignora búsquedas normales', () => {
    expect(detectAlarmSymptoms('cardiólogo')).toEqual([])
    expect(detectAlarmSymptoms('dermatología')).toEqual([])
    expect(detectAlarmSymptoms('dolor de cabeza')).toEqual([])
    expect(detectAlarmSymptoms('')).toEqual([])
    expect(detectAlarmSymptoms('ab')).toEqual([])
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
    expect(tels).toContain('115')
    expect(tels).toContain('113')
    expect(tels).not.toContain('911')
    expect(peru!.note).toMatch(/911/i)
  })

  it('incluye fecha de revisión y fuente para Perú', () => {
    const peru = getEmergencyCountry('PE')
    expect(EMERGENCY_LAST_REVIEWED).toMatch(/2026/)
    expect(peru!.sourceLabel).toBeTruthy()
    expect(peru!.sourceUrl).toMatch(/^https:\/\/www\.gob\.pe\//)
  })

  it('todos los países tienen números marcables con etiqueta', () => {
    for (const [code, country] of Object.entries(EMERGENCY_BY_COUNTRY)) {
      expect(country.numbers.length, `${code} sin números`).toBeGreaterThan(0)
      for (const number of country.numbers) {
        expect(number.label, `${code} sin etiqueta`).toBeTruthy()
        expect(number.tel, `${code} sin teléfono`).toMatch(/^\d+$/)
      }
    }
  })

  it('devuelve null para un país no incluido (fallback)', () => {
    expect(getEmergencyCountry('ZZ')).toBeNull()
    expect(Object.keys(EMERGENCY_BY_COUNTRY).length).toBeGreaterThan(0)
  })
})
