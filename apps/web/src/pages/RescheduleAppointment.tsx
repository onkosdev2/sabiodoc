import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarPlus } from 'lucide-react'

import BackButton from '../components/BackButton'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import { Textarea } from '../components/ui/Field'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import {
  Appointment,
  getAppointment,
  getDoctorBookableSlots,
  BookableSlot,
  rescheduleAppointment,
} from '../api/appointments'

export default function RescheduleAppointment() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [slots, setSlots] = useState<BookableSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!appointmentId) return
      setLoading(true)
      try {
        const appointmentResponse = await getAppointment(Number(appointmentId))
        setAppointment(appointmentResponse)
        const slotsResponse = await getDoctorBookableSlots(appointmentResponse.doctor_id)
        const filteredSlots = slotsResponse.slots.filter((slot) => slot.starts_at !== appointmentResponse.scheduled_at)
        setSlots(filteredSlots)
        if (filteredSlots.length > 0) {
          setSelectedSlot(filteredSlots[0].starts_at)
        }
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, 'No se pudo cargar la cita'))
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [appointmentId])

  const groupedSlots = useMemo(
    () =>
      slots.reduce<Record<string, BookableSlot[]>>((accumulator, slot) => {
        const key = new Date(slot.starts_at).toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
        accumulator[key] = accumulator[key] || []
        accumulator[key].push(slot)
        return accumulator
      }, {}),
    [slots],
  )

  const handleReschedule = async () => {
    if (!appointment || !selectedSlot) return
    setSaving(true)
    try {
      await rescheduleAppointment(appointment.id, {
        scheduled_at: selectedSlot,
        duration_minutes: appointment.duration_minutes,
        reason,
      })
      toast.success('Cita reprogramada.')
      navigate('/me/appointments')
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, 'No se pudo reprogramar la cita'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <BackButton />

      <PageHeader
        title="Reprogramar cita"
        description="Selecciona un nuevo horario disponible con el mismo médico."
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : !appointment ? null : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">{appointment.specialty_name}</p>
            <p className="mt-1 text-sm text-slate-600">Con {appointment.doctor_name}</p>
            <p className="mt-2 text-sm text-slate-500">
              Actual: {new Date(appointment.scheduled_at).toLocaleString('es-ES')}
            </p>
          </div>

          {slots.length === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title="Sin horarios disponibles"
              description="Este médico no tiene otros horarios libres por ahora. Prueba más tarde."
            />
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedSlots).map(([day, daySlots]) => (
                <div key={day} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold capitalize text-slate-900">{day}</p>
                  <div role="radiogroup" aria-label={`Horarios disponibles ${day}`} className="mt-4 flex flex-wrap gap-3">
                    {daySlots.map((slot) => {
                      const isSelected = selectedSlot === slot.starts_at
                      return (
                        <button
                          key={slot.starts_at}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setSelectedSlot(slot.starts_at)}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                            isSelected
                              ? 'bg-primary-600 text-white'
                              : 'border border-slate-300 bg-white text-slate-700 hover:border-primary-400'
                          }`}
                        >
                          {new Date(slot.starts_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Textarea
              label="Motivo de la reprogramación"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-28"
              placeholder="Indica por qué necesitas mover la cita."
            />
          </div>

          <Button
            onClick={handleReschedule}
            disabled={!selectedSlot}
            loading={saving}
            leftIcon={<CalendarPlus className="h-4 w-4" />}
          >
            Confirmar nuevo horario
          </Button>
        </>
      )}
    </div>
  )
}
