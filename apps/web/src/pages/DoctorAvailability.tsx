import { useEffect, useState } from 'react'
import { Clock3, Loader2, Plus, Trash2 } from 'lucide-react'

import { AvailabilitySlotInput, getDoctorAvailability, updateDoctorAvailability } from '../api/appointments'

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const emptySlot = (): AvailabilitySlotInput => ({
  weekday: 0,
  start_time: '09:00:00',
  end_time: '12:00:00',
  is_active: true,
})

export default function DoctorAvailability() {
  const [timezone, setTimezone] = useState('America/Bogota')
  const [slots, setSlots] = useState<AvailabilitySlotInput[]>([emptySlot()])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const loadAvailability = async () => {
      try {
        const response = await getDoctorAvailability()
        setTimezone(response.timezone)
        setSlots(
          response.slots.length > 0
            ? response.slots.map((slot) => ({
                weekday: slot.weekday,
                start_time: slot.start_time,
                end_time: slot.end_time,
                is_active: slot.is_active,
              }))
            : [emptySlot()]
        )
      } finally {
        setLoading(false)
      }
    }
    loadAvailability()
  }, [])

  const updateSlot = (index: number, patch: Partial<AvailabilitySlotInput>) => {
    setSlots((current) => current.map((slot, currentIndex) => (currentIndex === index ? { ...slot, ...patch } : slot)))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await updateDoctorAvailability({ timezone, slots })
      setMessage('Disponibilidad guardada. Los pacientes ya pueden reservar sobre esta agenda.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-950">Disponibilidad médica</h1>
        <p className="mt-2 text-stone-600">Define tu agenda semanal para que el paciente reserve citas desde el resumen IA.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-stone-500">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Cargando disponibilidad...
        </div>
      ) : (
        <>
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <label className="mb-2 block text-sm font-medium text-stone-700">Zona horaria</label>
            <input
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="input-field"
            />
          </div>

          <div className="space-y-4">
            {slots.map((slot, index) => (
              <div key={`${index}-${slot.weekday}-${slot.start_time}`} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
                  <select
                    value={slot.weekday}
                    onChange={(event) => updateSlot(index, { weekday: Number(event.target.value) })}
                    className="input-field"
                  >
                    {WEEKDAYS.map((day, weekdayIndex) => (
                      <option key={day} value={weekdayIndex}>
                        {day}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={slot.start_time.slice(0, 5)}
                    onChange={(event) => updateSlot(index, { start_time: `${event.target.value}:00` })}
                    className="input-field"
                  />
                  <input
                    type="time"
                    value={slot.end_time.slice(0, 5)}
                    onChange={(event) => updateSlot(index, { end_time: `${event.target.value}:00` })}
                    className="input-field"
                  />
                  <button
                    onClick={() => setSlots((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                    className="inline-flex items-center justify-center rounded-full border border-red-300 px-4 py-3 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSlots((current) => [...current, emptySlot()])}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 hover:border-stone-950"
            >
              <Plus className="h-4 w-4" />
              Agregar bloque
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary inline-flex items-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
              Guardar disponibilidad
            </button>
          </div>

          {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{message}</div>}
        </>
      )}
    </div>
  )
}
