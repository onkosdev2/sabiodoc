import { useEffect, useState } from 'react'
import { Send, Stethoscope } from 'lucide-react'

import {
  proposePatientProfileChanges,
} from '../api/doctors'
import type { PatientProfile, PatientProfileChangeRequest, PatientSex } from '../api/patients'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { Input, Select, Textarea } from './ui/Field'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import { buildProfilePayload } from '../utils/patientProfileFields'

const SEX_OPTIONS: Array<{ value: PatientSex; label: string }> = [
  { value: 'female', label: 'Femenino' },
  { value: 'male', label: 'Masculino' },
  { value: 'other', label: 'Otro' },
]

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

type EditableProfile = {
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null
  sex: PatientSex | null
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
}

function toEditable(profile: PatientProfile): EditableProfile {
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

const EMPTY_EDITABLE: EditableProfile = {
  first_name: null,
  last_name: null,
  date_of_birth: null,
  sex: null,
  phone: null,
  country: null,
  city: null,
  timezone: null,
  blood_type: null,
  allergies: null,
  chronic_conditions: null,
  current_medications: null,
  family_history: null,
  height_cm: null,
  weight_kg: null,
  smoker: null,
  alcohol: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  notes: null,
}

interface PatientProfileEditModalProps {
  open: boolean
  onClose: () => void
  patientId: number
  patientName: string
  profile: PatientProfile | null
  onSubmitted: (request: PatientProfileChangeRequest) => void
}

/**
 * Formulario para que el médico proponga datos del paciente. Los cambios no se
 * aplican directo: quedan pendientes de aprobación del paciente.
 */
export default function PatientProfileEditModal({
  open,
  onClose,
  patientId,
  patientName,
  profile,
  onSubmitted,
}: PatientProfileEditModalProps) {
  const toast = useToast()
  const [form, setForm] = useState<EditableProfile | null>(null)
  const [doctorMessage, setDoctorMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(profile ? toEditable(profile) : { ...EMPTY_EDITABLE })
      setDoctorMessage('')
    }
  }, [open, profile])

  const set = <K extends keyof EditableProfile>(field: K, value: EditableProfile[K]) => {
    setForm((current) => (current ? { ...current, [field]: value } : current))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    try {
      const request = await proposePatientProfileChanges(patientId, {
        ...buildProfilePayload(form),
        doctor_message: doctorMessage.trim() || null,
      })
      toast.success('Propuesta enviada. El paciente debe aprobar los cambios.')
      onSubmitted(request)
      onClose()
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo enviar la propuesta de cambios.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Proponer cambios en los datos del paciente"
      description={`Los cambios sobre el perfil de ${patientName} deben ser aprobados por el paciente antes de aplicarse.`}
      icon={<Stethoscope className="h-5 w-5 text-primary-600" />}
      className="max-w-2xl"
    >
      {form && (
        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Datos personales</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Nombres" value={form.first_name ?? ''} onChange={(e) => set('first_name', e.target.value || null)} />
              <Input label="Apellidos" value={form.last_name ?? ''} onChange={(e) => set('last_name', e.target.value || null)} />
              <Input
                label="Fecha de nacimiento"
                type="date"
                value={form.date_of_birth ?? ''}
                onChange={(e) => set('date_of_birth', e.target.value || null)}
              />
              <Select label="Sexo" value={form.sex ?? ''} onChange={(e) => set('sex', (e.target.value || null) as PatientSex | null)}>
                <option value="">Sin especificar</option>
                {SEX_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input label="Teléfono" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value || null)} />
              <Input label="País" value={form.country ?? ''} onChange={(e) => set('country', e.target.value || null)} />
              <Input label="Ciudad" value={form.city ?? ''} onChange={(e) => set('city', e.target.value || null)} />
              <Input label="Zona horaria" value={form.timezone ?? ''} onChange={(e) => set('timezone', e.target.value || null)} />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Datos clínicos</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Select label="Grupo sanguíneo" value={form.blood_type ?? ''} onChange={(e) => set('blood_type', e.target.value || null)}>
                <option value="">Sin especificar</option>
                {BLOOD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
              <Input
                label="Altura (cm)"
                type="number"
                inputMode="numeric"
                min={30}
                max={260}
                value={form.height_cm ?? ''}
                onChange={(e) => set('height_cm', e.target.value ? Number(e.target.value) : null)}
              />
              <Input
                label="Peso (kg)"
                type="number"
                inputMode="numeric"
                min={2}
                max={500}
                value={form.weight_kg ?? ''}
                onChange={(e) => set('weight_kg', e.target.value ? Number(e.target.value) : null)}
              />
              <div className="flex items-end gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={form.smoker ?? false}
                    onChange={(e) => set('smoker', e.target.checked)}
                  />
                  Fumador
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={form.alcohol ?? false}
                    onChange={(e) => set('alcohol', e.target.checked)}
                  />
                  Consume alcohol
                </label>
              </div>
              <div className="md:col-span-2">
                <Textarea
                  label="Alergias"
                  className="min-h-20"
                  value={form.allergies ?? ''}
                  onChange={(e) => set('allergies', e.target.value || null)}
                />
              </div>
              <div className="md:col-span-2">
                <Textarea
                  label="Enfermedades crónicas"
                  className="min-h-20"
                  value={form.chronic_conditions ?? ''}
                  onChange={(e) => set('chronic_conditions', e.target.value || null)}
                />
              </div>
              <div className="md:col-span-2">
                <Textarea
                  label="Medicación actual"
                  className="min-h-20"
                  value={form.current_medications ?? ''}
                  onChange={(e) => set('current_medications', e.target.value || null)}
                />
              </div>
              <div className="md:col-span-2">
                <Textarea
                  label="Antecedentes familiares"
                  className="min-h-20"
                  value={form.family_history ?? ''}
                  onChange={(e) => set('family_history', e.target.value || null)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Contacto de emergencia y notas
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Nombre del contacto"
                value={form.emergency_contact_name ?? ''}
                onChange={(e) => set('emergency_contact_name', e.target.value || null)}
              />
              <Input
                label="Teléfono del contacto"
                value={form.emergency_contact_phone ?? ''}
                onChange={(e) => set('emergency_contact_phone', e.target.value || null)}
              />
              <div className="md:col-span-2">
                <Textarea
                  label="Notas adicionales"
                  className="min-h-20"
                  value={form.notes ?? ''}
                  onChange={(e) => set('notes', e.target.value || null)}
                />
              </div>
            </div>
          </section>

          <section>
            <Textarea
              label="Mensaje para el paciente (opcional)"
              className="min-h-20"
              value={doctorMessage}
              onChange={(e) => setDoctorMessage(e.target.value)}
              placeholder="Explica brevemente por qué propones estos cambios."
            />
          </section>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} leftIcon={<Send className="h-4 w-4" />}>
              Enviar propuesta
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
