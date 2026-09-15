import { useState, useEffect } from 'react'
import { Loader2, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { submitGuideStep, GuideHistoryItem, GuideStepResponse } from '../api/guide'
import type { TriageResult } from '../api/triage'
import TriageResultCard from '../components/TriageResultCard'
import BackButton from '../components/BackButton'

export default function Guide() {
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
      console.error('Error en la guía IA:', err)
      setError('No pudimos continuar la guía. Por favor, intenta de nuevo.')
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
    fetchStep([])
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        <p className="text-gray-500">La IA está preparando la primera pregunta...</p>
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
      <div className="max-w-2xl mx-auto pb-12">
        <BackButton />
        <TriageResultCard result={triageResult} />
        <div className="mt-6 text-center">
          <button onClick={handleReset} className="btn-secondary">
            Empezar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const currentAnswer = current?.options.find((o) => o.value === selected)

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <BackButton />

      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-6 h-6 text-primary-500" />
        <h1 className="text-3xl font-bold text-gray-800">Guía de Especialidades</h1>
      </div>
      <p className="text-gray-600 mb-6">
        La IA te hará algunas preguntas. Elige siempre una opción y te orientará hacia
        la especialidad médica más adecuada.
      </p>

      {history.length > 0 && (
        <div className="space-y-4 mb-6">
          {history.map((item, index) => (
            <div key={index} className="space-y-1">
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 text-gray-800 max-w-[85%]">
                  {item.question}
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-primary-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[85%]">
                  {item.answer_label}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {current && (
        <>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              {Array.from({ length: current.max_steps }).map((_, index) => (
                <div
                  key={index}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    index < current.step ? 'bg-primary-500' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-gray-500">
              Pregunta {current.step} de {current.max_steps}
            </p>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">{current.question}</h2>

            <div className="space-y-3 mb-8">
              {current.options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  disabled={submitting}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all disabled:opacity-60 ${
                    selected === option.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                disabled={history.length === 0 || submitting}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </button>

              <button
                onClick={handleContinue}
                disabled={!currentAnswer || submitting}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Pensando...
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
