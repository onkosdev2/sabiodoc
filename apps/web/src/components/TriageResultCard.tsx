import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle, AlertCircle, XCircle, ArrowRight } from 'lucide-react'
import { TriageResult } from '../api/triage'

interface TriageResultCardProps {
  result: TriageResult
}

const urgencyConfig = {
  low: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    label: 'Urgencia Baja'
  },
  medium: {
    icon: AlertCircle,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    label: 'Urgencia Media'
  },
  high: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    label: 'Urgencia Alta'
  },
  emergency: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: '⚠️ EMERGENCIA'
  }
}

export default function TriageResultCard({ result }: TriageResultCardProps) {
  const config = urgencyConfig[result.urgency]
  const Icon = config.icon

  return (
    <div className={`rounded-xl border-2 ${config.border} ${config.bg} p-6`}>
      <div className="flex items-center gap-3 mb-4">
        <Icon className={`w-8 h-8 ${config.color}`} />
        <h3 className={`text-xl font-bold ${config.color}`}>{config.label}</h3>
      </div>

      {result.urgency === 'emergency' && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-4">
          <p className="text-red-800 font-medium">
            Los síntomas que describes pueden requerir atención médica inmediata.
            Por favor, acude a urgencias o llama a servicios de emergencia.
          </p>
          <Link 
            to="/emergency" 
            className="inline-block mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Ver información de emergencias
          </Link>
        </div>
      )}

      <div className="mb-4">
        <h4 className="font-semibold text-gray-800 mb-2">Especialidad recomendada:</h4>
        <Link 
          to={`/specialties/${result.recommended_specialty_slug}`}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Ir a {result.recommended_specialty_slug.replace(/-/g, ' ')}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="mb-4">
        <h4 className="font-semibold text-gray-800 mb-2">Razones:</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          {result.rationale_bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      </div>

      {result.clarifying_questions.length > 0 && (
        <div className="mb-4">
          <h4 className="font-semibold text-gray-800 mb-2">Preguntas para aclarar:</h4>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            {result.clarifying_questions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </div>
      )}

      {result.alternatives.length > 0 && (
        <div className="mb-4">
          <h4 className="font-semibold text-gray-800 mb-2">Alternativas:</h4>
          <div className="space-y-2">
            {result.alternatives.map((alt, index) => (
              <div key={index} className="flex items-center gap-2">
                <Link 
                  to={`/specialties/${alt.specialty_slug}`}
                  className="text-primary-600 hover:underline"
                >
                  {alt.specialty_slug.replace(/-/g, ' ')}
                </Link>
                <span className="text-gray-500">- {alt.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.red_flags_detected.length > 0 && (
        <div className="mb-4 bg-red-100 border border-red-200 rounded-lg p-3">
          <h4 className="font-semibold text-red-800 mb-2">⚠️ Señales de alerta detectadas:</h4>
          <ul className="list-disc list-inside space-y-1 text-red-700">
            {result.red_flags_detected.map((flag, index) => (
              <li key={index}>{flag}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 p-3 bg-gray-100 rounded-lg">
        <p className="text-sm text-gray-600 italic">{result.disclaimer}</p>
      </div>
    </div>
  )
}
