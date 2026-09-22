import { useState } from 'react'
import { Check, ShieldCheck, UserRoundCog, X } from 'lucide-react'

import {
  resolvePatientProfileChangeRequest,
  type PatientProfileChangeRequest,
} from '../api/patients'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import { PATIENT_PROFILE_FIELD_LABELS, formatPatientProfileValue } from '../utils/patientProfileFields'
import Button from './ui/Button'

interface PatientProfileChangeReviewProps {
  requests: PatientProfileChangeRequest[]
  onResolved: () => void
}

/**
 * Aviso al paciente con los cambios que propuso un médico. Nada se aplica hasta
 * que el paciente los aprueba explícitamente.
 */
export default function PatientProfileChangeReview({ requests, onResolved }: PatientProfileChangeReviewProps) {
  const toast = useToast()
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [busyId, setBusyId] = useState<number | null>(null)

  if (requests.length === 0) return null

  const handleResolve = async (request: PatientProfileChangeRequest, action: 'approve' | 'reject') => {
    setBusyId(request.id)
    try {
      await resolvePatientProfileChangeRequest(request.id, action, notes[request.id]?.trim() || null)
      toast.success(
        action === 'approve'
          ? 'Cambios aceptados. Tus datos se actualizaron.'
          : 'Cambios rechazados. Tus datos no se modificaron.',
      )
      onResolved()
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo procesar la solicitud.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-amber-100 p-2">
          <UserRoundCog className="h-5 w-5 text-amber-700" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-amber-900">
            {requests.length === 1
              ? 'Un médico propone actualizar tus datos'
              : `${requests.length} médicos proponen actualizar tus datos`}
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Revisa los cambios propuestos. Nada se guardará hasta que los aceptes.
          </p>
        </div>
      </div>

      {requests.map((request) => {
        const isBusy = busyId === request.id
        const changes = Object.entries(request.proposed_changes)
        return (
          <div key={request.id} className="rounded-2xl border border-amber-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                Propuesta de {request.doctor_name || 'un médico'}
              </p>
              {request.created_at && (
                <span className="text-xs text-slate-500">
                  {new Date(request.created_at).toLocaleString('es-ES')}
                </span>
              )}
            </div>

            {request.doctor_message && (
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <span className="font-medium">Mensaje: </span>
                {request.doctor_message}
              </p>
            )}

            <div className="mt-4 space-y-3">
              {changes.map(([field, diff]) => (
                <div key={field} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {PATIENT_PROFILE_FIELD_LABELS[field] ?? field}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-slate-500 line-through">
                      {formatPatientProfileValue(field, diff.from)}
                    </span>
                    <span aria-hidden="true" className="text-slate-500">
                      →
                    </span>
                    <span className="font-medium text-emerald-700">
                      {formatPatientProfileValue(field, diff.to)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <textarea
                className="input-field min-h-16 w-full"
                placeholder="Nota para el médico (opcional)"
                value={notes[request.id] ?? ''}
                onChange={(e) => setNotes((current) => ({ ...current, [request.id]: e.target.value }))}
                disabled={isBusy}
              />
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => handleResolve(request, 'reject')}
                disabled={isBusy}
                leftIcon={<X className="h-4 w-4" />}
              >
                Rechazar
              </Button>
              <Button
                variant="success"
                onClick={() => handleResolve(request, 'approve')}
                loading={isBusy}
                leftIcon={<Check className="h-4 w-4" />}
              >
                Aceptar cambios
              </Button>
            </div>
          </div>
        )
      })}

      <p className="flex items-center gap-2 text-xs text-amber-800">
        <ShieldCheck className="h-3.5 w-3.5" /> Solo tú puedes autorizar cambios en tu información clínica.
      </p>
    </section>
  )
}
