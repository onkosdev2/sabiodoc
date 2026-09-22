import type { PatientProfilePayload } from '../api/patients'

/** Campos que cuentan para considerar el perfil "completado". */
const PROFILE_COMPLETION_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'sex',
  'phone',
  'blood_type',
  'allergies',
  'chronic_conditions',
  'current_medications',
  'family_history',
] as const

/** Umbral de campos clave a partir del cual el perfil se considera suficiente. */
export const PROFILE_COMPLETION_THRESHOLD = 3

interface ProfileCompletionInput {
  first_name?: string | null
  last_name?: string | null
  date_of_birth?: string | null
  sex?: string | null
  phone?: string | null
  blood_type?: string | null
  allergies?: string | null
  chronic_conditions?: string | null
  current_medications?: string | null
  family_history?: string | null
}

/** Nº de campos clave completados en el perfil del paciente. */
export function countFilledProfileFields(profile: ProfileCompletionInput): number {
  return PROFILE_COMPLETION_FIELDS.filter((field) => {
    const value = profile[field]
    return value !== null && value !== undefined && `${value}`.trim() !== ''
  }).length
}

/** Perfil prácticamente vacío: conviene recomendar completarlo. */
export function isPatientProfileIncomplete(profile: ProfileCompletionInput): boolean {
  return countFilledProfileFields(profile) < PROFILE_COMPLETION_THRESHOLD
}

/** Etiquetas legibles de los campos editables del perfil del paciente. */
export const PATIENT_PROFILE_FIELD_LABELS: Record<string, string> = {
  first_name: 'Nombres',
  last_name: 'Apellidos',
  date_of_birth: 'Fecha de nacimiento',
  sex: 'Sexo',
  phone: 'Teléfono',
  country: 'País',
  city: 'Ciudad',
  timezone: 'Zona horaria',
  blood_type: 'Grupo sanguíneo',
  allergies: 'Alergias',
  chronic_conditions: 'Enfermedades crónicas',
  current_medications: 'Medicación actual',
  family_history: 'Antecedentes familiares',
  height_cm: 'Altura (cm)',
  weight_kg: 'Peso (kg)',
  smoker: 'Fumador',
  alcohol: 'Consume alcohol',
  emergency_contact_name: 'Contacto de emergencia',
  emergency_contact_phone: 'Teléfono de emergencia',
  notes: 'Notas',
}

/** Convierte un valor crudo del perfil en un texto legible para diferencias. */
export function formatPatientProfileValue(field: string, value: unknown): string {
  if (value === null || value === undefined || `${value}`.trim() === '') {
    return 'Sin especificar'
  }
  if (field === 'sex') {
    return value === 'male' ? 'Masculino' : value === 'female' ? 'Femenino' : value === 'other' ? 'Otro' : `${value}`
  }
  if (field === 'smoker' || field === 'alcohol') {
    if (value === true) return 'Sí'
    if (value === false) return 'No'
    return 'Sin especificar'
  }
  return `${value}`
}

/** Construye el payload completo a partir de un perfil (para proponer cambios). */
export function buildProfilePayload(profile: {
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null
  sex: PatientProfilePayload['sex']
  phone: string | null
  country: string | null
  city: string | null
  timezone: string | null
  blood_type: string | null
  allergies: string | null
  chronic_conditions: string | null
  current_medications: string | null
  family_history: string | null
  height_cm: number | null
  weight_kg: number | null
  smoker: boolean | null
  alcohol: boolean | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  notes: string | null
}): PatientProfilePayload {
  return {
    first_name: profile.first_name,
    last_name: profile.last_name,
    date_of_birth: profile.date_of_birth,
    sex: profile.sex,
    phone: profile.phone,
    country: profile.country,
    city: profile.city,
    timezone: profile.timezone,
    blood_type: profile.blood_type,
    allergies: profile.allergies,
    chronic_conditions: profile.chronic_conditions,
    current_medications: profile.current_medications,
    family_history: profile.family_history,
    height_cm: profile.height_cm,
    weight_kg: profile.weight_kg,
    smoker: profile.smoker,
    alcohol: profile.alcohol,
    emergency_contact_name: profile.emergency_contact_name,
    emergency_contact_phone: profile.emergency_contact_phone,
    notes: profile.notes,
  }
}
