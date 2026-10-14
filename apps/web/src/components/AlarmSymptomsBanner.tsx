import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

interface AlarmSymptomsBannerProps {
  /** Banderas de alarma detectadas (de `detectAlarmSymptoms`). */
  flags: string[]
}

/**
 * Aviso de urgencia cuando lo escrito contiene síntomas de alarma.
 *
 * Es una salvaguarda: evita que una búsqueda léxica devuelva una especialidad
 * irrelevante ante un posible cuadro urgente.
 */
export default function AlarmSymptomsBanner({ flags }: AlarmSymptomsBannerProps) {
  if (flags.length === 0) return null

  return (
    <div
      role="alert"
      className="mb-6 rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-red-900"
    >
      <p className="flex items-start gap-2 font-semibold">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        Esto podría ser una urgencia médica
      </p>
      <p className="mt-1 text-sm">
        Detectamos señales de alarma: <strong>{flags.join(', ')}</strong>. No uses el buscador de
        especialidades ni la IA para esto.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/emergency"
          className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Ver números de emergencia
        </Link>
        <Link
          to="/triage"
          className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Orientarme con la IA
        </Link>
      </div>
      <p className="mt-2 text-xs text-red-700">
        Si los síntomas son intensos o empeoran, llama al número de emergencias de tu país o acude a
        urgencias.
      </p>
    </div>
  )
}
