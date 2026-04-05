import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarPlus, Loader2 } from 'lucide-react'

import BackButton from '../components/BackButton'
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
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [slots, setSlots] = useState<BookableSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!appointmentId) {
        return
      }
      setLoading(true)
      setError(null)
      try {
        const appointmentResponse = await getAppointment(Number(appointmentId))
        setAppointment(appointmentResponse)
        const slotsResponse = await getDoctorBookableSlots(appointmentResponse.doctor_id)
        const filteredSlots = slotsResponse.slots.filter((slot) => slot.starts_at !== appointmentResponse.scheduled_at)
        setSlots(filteredSlots)
        if (filteredSlots.length > 0) {
          setSelectedSlot(filteredSlots[0].starts_at)
        }
      } catch (requestError: any) {
        setError(requestError.response?.data?.detail || 'No se pudo cargar la cita')
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
    [slots]
  )

  const handleReschedule = async () => {
    if (!appointment || !selectedSlot) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await rescheduleAppointment(appointment.id, {
        scheduled_at: selectedSlot,
        duration_minutes: appointment.duration_minutes,
        reason,
      })
      navigate('/me/appointments')
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'No se pudo reprogramar la cita')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <BackButton />
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reprogramar cita</h1>
        <p className="mt-2 text-gray-600">Selecciona un nuevo horario disponible con el mismo médico.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Cargando horarios...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : !appointment ? null : (
        <>
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-lg font-semibold text-gray-900">{appointment.specialty_name}</p>
            <p className="mt-1 text-sm text-gray-600">Con {appointment.doctor_name}</p>
            <p className="mt-2 text-sm text-gray-500">
              Actual: {new Date(appointment.scheduled_at).toLocaleString('es-ES')}
            </p>
          </div>

          <div className="space-y-4">
            {Object.entries(groupedSlots).map(([day, daySlots]) => (
              <div key={day} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold capitalize text-gray-900">{day}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {daySlots.map((slot) => (
                    <button
                      key={slot.starts_at}
                      onClick={() => setSelectedSlot(slot.starts_at)}
                      className={`rounded-full px-4 py-2 text-sm font-medium ${
                        selectedSlot === slot.starts_at
                          ? 'bg-primary-600 text-white'
                          : 'border border-gray-300 bg-white text-gray-700 hover:border-primary-400'
                      }`}
                    >
                      {new Date(slot.starts_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <label className="mb-2 block text-sm font-medium text-gray-700">Motivo de la reprogramación</label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="input-field min-h-28"
              placeholder="Indica por qué necesitas mover la cita."
            />
          </div>

          <button
            onClick={handleReschedule}
            disabled={!selectedSlot || saving}
            className="btn-primary inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            Confirmar nuevo horario
          </button>
        </>
      )}
    </div>
  )
}
