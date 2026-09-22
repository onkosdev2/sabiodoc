import { ConsultationStructuredIntake } from '../api/consultations'

interface StructuredIntakeCardProps {
  intake: ConsultationStructuredIntake
  title?: string
  description?: string
  className?: string
}

const COMPLETENESS_LABELS: Record<string, string> = {
  low: 'Baja',
  partial: 'Media',
  high: 'Alta',
}

const renderList = (items: string[]) => {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Sin datos relevantes.</p>
  }

  return (
    <ul className="space-y-1 text-sm text-slate-700">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function StructuredIntakeCard({
  intake,
  title = 'Ficha previa IA',
  description,
  className = '',
}: StructuredIntakeCardProps) {
  const completeness = intake.completeness || 'partial'
  const completenessLabel = COMPLETENESS_LABELS[completeness] || completeness

  return (
    <section className={`rounded-2xl border border-indigo-100 bg-indigo-50 p-4 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-indigo-700">{title}</p>
          {description && <p className="mt-1 text-xs text-indigo-700/80">{description}</p>}
          <p className="mt-1 text-sm text-indigo-900">
            Nivel de detalle de la ficha:{' '}
            <span className="font-medium" title="Indica cuántos datos clave se pudieron extraer de la conversación; no si la consulta finalizó.">
              {completenessLabel}
            </span>
          </p>
        </div>
      </div>

      {intake.chief_complaint && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Motivo principal</p>
          <p className="mt-2 text-sm text-indigo-950">{intake.chief_complaint}</p>
        </div>
      )}

      {intake.duration_and_evolution && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Duración y evolución</p>
          <p className="mt-2 text-sm text-indigo-950">{intake.duration_and_evolution}</p>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Síntomas</p>
          <div className="mt-2">{renderList(intake.symptom_summary)}</div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Antecedentes relevantes</p>
          <div className="mt-2">{renderList(intake.relevant_history)}</div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Medicamentos actuales</p>
          <div className="mt-2">{renderList(intake.current_medications)}</div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Factores de riesgo</p>
          <div className="mt-2">{renderList(intake.risk_factors)}</div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Alertas</p>
          <div className="mt-2">{renderList(intake.red_flags)}</div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Objetivos del paciente</p>
          <div className="mt-2">{renderList(intake.patient_questions_or_goals)}</div>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Foco sugerido para el médico</p>
        <div className="mt-2">{renderList(intake.recommended_focus_for_doctor)}</div>
      </div>
    </section>
  )
}
