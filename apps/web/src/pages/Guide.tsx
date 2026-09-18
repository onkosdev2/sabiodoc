import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Lightbulb } from 'lucide-react'

import { submitGuideStep, GuideHistoryItem, GuideStepResponse } from '../api/guide'
import type { TriageResult } from '../api/triage'
import TriageResultCard from '../components/TriageResultCard'
import BackButton from '../components/BackButton'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import { getApiErrorMessage } from '../utils/apiError'
import { useToast } from '../context/ToastContext'

export default function Guide() {
  const toast = useToast()
  const [history, setHistory] = useState<GuideHistoryItem[]>([])
  const [current, setCurrent] = useState<GuideStepResponse | null>(null)
  const [result, setResult] = useState<GuideStepResponse | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStep = async (nextHistory: GuideHistoryItem[]) => {
    setSubmitting(true)
    setError(null)
    try {
      const data = await submitGuideStep(nextHistory)
      setHistory(nextHistory)
      if (data.status === 'recommendation') {
        setResult(data)
        setCurrent(null)
      } else {
        setCurrent(data)
        setResult(null)
      }
      setSelected(null)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'No pudimos continuar la guía. Intenta de nuevo.'))
    } finally {
      setSubmitting(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStep([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelect = (value: string) => {
    if (submitting) return
    setSelected(value)
  }

  const handleContinue = () => {
    if (!current || !selected || !current.question_id) return
    const option = current.options.find((o) => o.value === selected)
    if (!option) return

    const item: GuideHistoryItem = {
      question_id: current.question_id,
      question: current.question ?? '',
      answer: option.value,
      answer_label: option.label,
    }
    fetchStep([...history, item])
  }

  const handleBack = () => {
    if (submitting || history.length === 0) return
    fetchStep(history.slice(0, -1))
  }

  const handleReset = () => {
    setResult(null)
    setCurrent(null)
    setHistory([])
    setSelected(null)
    setLoading(true)
    fetchStep([])
  }

  if (loading || (submitting && !current && !result)) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (result) {
    const triageResult: TriageResult = {
      urgency: result.urgency,
      recommended_specialty_slug: result.recommended_specialty_slug ?? 'medicina-interna',
      rationale_bullets: result.rationale_bullets,
      clarifying_questions: result.clarifying_questions ?? [],
      alternatives: result.alternatives,
      red_flags_detected: result.red_flags_detected,
      disclaimer: result.disclaimer,
    }

    return (
      <div className="mx-auto max-w-2xl pb-12">
        <BackButton />
        <TriageResultCard result={triageResult} />
        <div className="mt-6 text-center">
          <Button variant="secondary" onClick={handleReset}>
            Empezar de nuevo
          </Button>
        </div>
      </div>
    )
  }

  const currentAnswer = current?.options.find((o) => o.value === selected)

  return (
    <div className="mx-auto max-w-2xl pb-12">
      <BackButton />

      <PageHeader
        icon={Lightbulb}
        title="Guía de especialidades"
        description="La IA te hará algunas preguntas. Elige siempre una opción y te orientará hacia la especialidad médica más adecuada."
        className="mb-6"
      />

      {current && (
        <>
          <div className="mb-4">
            <div
              role="progressbar"
              aria-valuenow={current.step}
              aria-valuemin={1}
              aria-valuemax={current.max_steps}
              aria-label="Progreso de la guía"
              className="mb-2 flex items-center gap-2"
            >
              {Array.from({ length: current.max_steps }).map((_, index) => (
                <div
                  key={index}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    index < current.step ? 'bg-primary-500' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-slate-500">
              Pregunta {current.step} de {current.max_steps}
            </p>
          </div>

          <div className="card">
            <h2 className="mb-6 text-xl font-semibold text-slate-800">{current.question}</h2>

            <div role="radiogroup" aria-label="Opciones de respuesta" className="mb-8 space-y-3">
              {current.options.map((option) => {
                const isSelected = selected === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelect(option.value)}
                    disabled={submitting}
                    className={`w-full rounded-lg border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60 ${
                      isSelected ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-primary-300'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                onClick={handleBack}
                disabled={history.length === 0 || submitting}
                leftIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Atrás
              </Button>

              <Button
                onClick={handleContinue}
                disabled={!currentAnswer || submitting}
                loading={submitting}
                rightIcon={!submitting ? <ArrowRight className="h-4 w-4" /> : undefined}
              >
                {submitting ? 'Pensando...' : 'Continuar'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
