import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarPlus, Loader2 } from 'lucide-react'

import BackButton from '../components/BackButton'
import { createAppointment as createAppointmentRequest, getDoctorBookableSlots, BookableSlot } from '../api/appointments'
import { getConsultation, Consultation } from '../api/consultations'
import { DoctorCard, getDoctorsBySpecialty } from '../api/doctors'

export default function BookAppointment() {
  const { consultationId } = useParams<{ consultationId: string }>()
  const navigate = useNavigate()
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [doctors, setDoctors] = useState<DoctorCard[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorCard | null>(null)
  const [slots, setSlots] = useState<BookableSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [patientNote, setPatientNote] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(true)
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadBookingData = async () => {
      if (!consultationId) {
        return
      }
      try {
        const consultationResponse = await getConsultation(Number(consultationId))
        setConsultation(consultationResponse)
        if (!consultationResponse.specialty) {
          throw new Error('La consulta no tiene especialidad asociada')
        }
        const doctorsResponse = await getDoctorsBySpecialty(consultationResponse.specialty.slug)
        setDoctors(doctorsResponse.doctors)
        if (doctorsResponse.doctors.length > 0) {
          const firstDoctor = doctorsResponse.doctors[0]
          setSelectedDoctor(firstDoctor)
          const slotsResponse = await getDoctorBookableSlots(firstDoctor.id)
          setSlots(slotsResponse.slots)
          if (slotsResponse.slots.length > 0) {
            setSelectedSlot(slotsResponse.slots[0].starts_at)
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || 'No se pudo cargar la agenda')
      } finally {
        setLoading(false)
      }
    }
    loadBookingData()
  }, [consultationId])

  const groupedSlots = useMemo(() => {
    return slots.reduce<Record<string, BookableSlot[]>>((accumulator, slot) => {
      const key = new Date(slot.starts_at).toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
      accumulator[key] = accumulator[key] || []
      accumulator[key].push(slot)
      return accumulator
    }, {})
  }, [slots])

  const handleDoctorChange = async (doctorId: number) => {
    const doctor = doctors.find((item) => item.id === doctorId) || null
    setSelectedDoctor(doctor)
    setSelectedSlot('')
    setSlots([])
    if (!doctor) {
      return
    }
    const response = await getDoctorBookableSlots(doctor.id)
    setSlots(response.slots)
    if (response.slots.length > 0) {
      setSelectedSlot(response.slots[0].starts_at)
    }
  }

  const handleBook = async () => {
    if (!consultation || !selectedDoctor || !selectedSlot) {
      return
    }
    setBooking(true)
    setError(null)
    try {
      await createAppointmentRequest({
        doctor_id: selectedDoctor.id,
        consultation_id: consultation.id,
        scheduled_at: selectedSlot,
        duration_minutes: 30,
        patient_note: patientNote,
        accepted_terms: acceptedTerms,
        consent_text_version: 'v1',
      })
      navigate('/me/appointments')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'No se pudo reservar la cita')
    } finally {
      setBooking(false)
    }
  }

  return (
    <div className="space-y-6">
      <BackButton />
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Agendar videoconsulta</h1>
        <p className="mt-2 text-gray-600">Usamos tu resumen IA para preparar al médico antes de la cita.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Cargando agenda disponible...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : (
        <>
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <label className="mb-2 block text-sm font-medium text-gray-700">Médico</label>
            <select
              value={selectedDoctor?.id ?? ''}
              onChange={(event) => handleDoctorChange(Number(event.target.value))}
              className="input-field"
            >
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.display_name} · US$ {(doctor.price_per_min_cents / 100).toFixed(2)}/min
                </option>
              ))}
            </select>
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
            <label className="mb-2 block text-sm font-medium text-gray-700">Nota adicional para el médico</label>
            <textarea
              value={patientNote}
              onChange={(event) => setPatientNote(event.target.value)}
              className="input-field min-h-32"
              placeholder="Puedes aclarar cambios recientes, exámenes previos o disponibilidad."
            />
            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-1"
              />
              <span>
                Confirmo que entiendo el consentimiento de videoconsulta, el tratamiento de datos clínicos y que esta atención no sustituye urgencias.
              </span>
            </label>
          </div>

          <button onClick={handleBook} disabled={!selectedSlot || booking || !acceptedTerms} className="btn-primary inline-flex items-center gap-2">
            {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            Confirmar cita
          </button>
        </>
      )}
    </div>
  )
}
