import { describe, it, expect } from 'vitest'

import { buildProfilePayload, countFilledProfileFields, formatPatientProfileValue, isPatientProfileIncomplete } from './patientProfileFields'

describe('formatPatientProfileValue', () => {
  it('traduce sexo y campos booleanos', () => {
    expect(formatPatientProfileValue('sex', 'female')).toBe('Femenino')
    expect(formatPatientProfileValue('sex', 'male')).toBe('Masculino')
    expect(formatPatientProfileValue('sex', 'other')).toBe('Otro')
    expect(formatPatientProfileValue('smoker', true)).toBe('Sí')
    expect(formatPatientProfileValue('alcohol', false)).toBe('No')
  })

  it('muestra "Sin especificar" para valores vacíos', () => {
    expect(formatPatientProfileValue('allergies', null)).toBe('Sin especificar')
    expect(formatPatientProfileValue('allergies', undefined)).toBe('Sin especificar')
    expect(formatPatientProfileValue('city', '   ')).toBe('Sin especificar')
  })

  it('devuelve el valor tal cual para el resto de campos', () => {
    expect(formatPatientProfileValue('height_cm', 170)).toBe('170')
  })
})

describe('isPatientProfileIncomplete', () => {
  it('considera incompleto un perfil vacío', () => {
    expect(isPatientProfileIncomplete({ first_name: null, sex: null })).toBe(true)
  })

  it('considera suficiente un perfil con 3 campos clave', () => {
    expect(isPatientProfileIncomplete({ first_name: 'Ana', last_name: 'Pérez', sex: 'female' })).toBe(false)
  })

  it('cuenta solo los campos con valor', () => {
    expect(countFilledProfileFields({ first_name: 'Ana', last_name: '   ', sex: null })).toBe(1)
  })
})

describe('buildProfilePayload', () => {
  it('copia los campos del perfil al payload', () => {
    const payload = buildProfilePayload({
      first_name: 'Ana',
      last_name: null,
      date_of_birth: null,
      sex: 'female',
      phone: null,
      country: null,
      city: null,
      timezone: null,
      blood_type: null,
      allergies: null,
      chronic_conditions: null,
      current_medications: null,
      family_history: null,
      height_cm: 170,
      weight_kg: null,
      smoker: null,
      alcohol: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      notes: null,
    })

    expect(payload.first_name).toBe('Ana')
    expect(payload.sex).toBe('female')
    expect(payload.height_cm).toBe(170)
    expect(payload.last_name).toBeNull()
  })
})
