import { useEffect, useMemo, useState } from 'react'
import { Clock3, Plus, Trash2 } from 'lucide-react'

import { AvailabilitySlotInput, getDoctorAvailability, updateDoctorAvailability } from '../api/appointments'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const emptySlot = (): AvailabilitySlotInput => ({
  weekday: 0,
  start_time: '09:00:00',
  end_time: '12:00:00',
  is_active: true,
})

export default function DoctorAvailability() {
  const toast = useToast()
  const [timezone, setTimezone] = useState('America/Bogota')
  const [slots, setSlots] = useState<AvailabilitySlotInput[]>([emptySlot()])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const timezoneClock = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('es-ES', {
        timeZone: timezone,
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(clock)
    } catch {
      return null
    }
  }, [clock, timezone])

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
            : [emptySlot()],
        )
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudo cargar tu disponibilidad.'))
      } finally {
        setLoading(false)
      }
    }
    loadAvailability()
  }, [toast])

  const updateSlot = (index: number, patch: Partial<AvailabilitySlotInput>) => {
    setSlots((current) => current.map((slot, currentIndex) => (currentIndex === index ? { ...slot, ...patch } : slot)))
  }

  const handleSave = async () => {
    if (slots.length === 0) {
      toast.warning('Agrega al menos un bloque de disponibilidad.')
      return
    }
    const invalid = slots.find((slot) => slot.start_time >= slot.end_time)
    if (invalid) {
      toast.error('La hora de inicio debe ser anterior a la de fin en todos los bloques.')
      return
    }

    setSaving(true)
    try {
      await updateDoctorAvailability({ timezone, slots })
      toast.success('Disponibilidad guardada. Los pacientes ya pueden reservar sobre esta agenda.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo guardar la disponibilidad.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disponibilidad médica"
        description="Define tu agenda semanal para que el paciente reserve citas desde el resumen IA."
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Zona horaria</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{timezone}</p>
            <p className="mt-1 text-xs text-slate-500">Se configura en tu perfil médico.</p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-5 py-3 text-right text-slate-50">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Hora local</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{timezoneClock ?? 'Zona horaria inválida'}</p>
          </div>
        </div>
        {!timezoneClock && (
          <Alert tone="warning" className="mt-4">
            La zona horaria configurada no es válida. Actualízala en tu perfil profesional.
          </Alert>
        )}
      </div>

      <div className="space-y-4">
        {slots.map((slot, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <select
                aria-label={`Día del bloque ${index + 1}`}
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
                aria-label={`Hora de inicio del bloque ${index + 1}`}
                value={slot.start_time.slice(0, 5)}
                onChange={(event) => updateSlot(index, { start_time: `${event.target.value}:00` })}
                className="input-field"
              />
              <input
                type="time"
                aria-label={`Hora de fin del bloque ${index + 1}`}
                value={slot.end_time.slice(0, 5)}
                onChange={(event) => updateSlot(index, { end_time: `${event.target.value}:00` })}
                className="input-field"
              />
              <Button
                variant="ghost"
                onClick={() => setSlots((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                aria-label={`Eliminar bloque ${index + 1}`}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={() => setSlots((current) => [...current, emptySlot()])}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Agregar bloque
        </Button>
        <Button onClick={handleSave} loading={saving} leftIcon={<Clock3 className="h-4 w-4" />}>
          Guardar disponibilidad
        </Button>
      </div>
    </div>
  )
}
