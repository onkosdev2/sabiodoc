import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react'
import { getGuideQuestions, submitGuideAnswers, GuideQuestion, GuideRecommendation } from '../api/guide'
import BackButton from '../components/BackButton'

export default function Guide() {
  const [questions, setQuestions] = useState<GuideQuestion[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [recommendation, setRecommendation] = useState<GuideRecommendation | null>(null)

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const data = await getGuideQuestions()
        setQuestions(data)
      } catch (error) {
        console.error('Error loading questions:', error)
      } finally {
        setLoading(false)
      }
    }
    loadQuestions()
  }, [])

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
  }

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const answersArray = Object.entries(answers).map(([question_id, answer]) => ({
        question_id,
        answer
      }))
      const result = await submitGuideAnswers(answersArray)
      setRecommendation(result)
    } catch (error) {
      console.error('Error submitting answers:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setCurrentStep(0)
    setAnswers({})
    setRecommendation(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    )
  }

  if (recommendation) {
    return (
      <div className="max-w-2xl mx-auto">
        <BackButton />
        
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <h1 className="text-2xl font-bold text-gray-800">
              Recomendación
            </h1>
          </div>

          <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-primary-800 mb-2">
              {recommendation.recommended_specialty_name}
            </h2>
            <p className="text-primary-700 mb-4">
              Confianza: <span className="font-medium capitalize">{recommendation.confidence}</span>
            </p>
            <p className="text-gray-700">{recommendation.reason}</p>
          </div>

          <Link
            to={`/specialties/${recommendation.recommended_specialty_slug}`}
            className="btn-primary inline-flex items-center gap-2 mb-6"
          >
            Ver especialidad
            <ArrowRight className="w-4 h-4" />
          </Link>

          <div className="bg-gray-100 rounded-lg p-4">
            <p className="text-sm text-gray-600 italic">
              {recommendation.disclaimer}
            </p>
          </div>

          <div className="mt-6 text-center">
            <button onClick={handleReset} className="btn-secondary">
              Empezar de nuevo
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentStep]
  const currentAnswer = answers[currentQuestion?.id]
  const isLastStep = currentStep === questions.length - 1
  const allAnswered = questions.every(q => answers[q.id])

  return (
    <div className="max-w-2xl mx-auto">
      <BackButton />
      
      <h1 className="text-3xl font-bold text-gray-800 mb-2">
        💡 Guía de Especialidades
      </h1>
      <p className="text-gray-600 mb-6">
        Responde estas preguntas para ayudarte a encontrar la especialidad adecuada.
      </p>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          {questions.map((_, index) => (
            <div
              key={index}
              className={`h-2 flex-1 rounded-full transition-colors ${
                index <= currentStep ? 'bg-primary-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-gray-500">
          Paso {currentStep + 1} de {questions.length}
        </p>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          {currentQuestion?.question}
        </h2>

        <div className="space-y-3 mb-8">
          {currentQuestion?.options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleAnswer(currentQuestion.id, option.value)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                currentAnswer === option.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-primary-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Anterior
          </button>

          {isLastStep ? (
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              className="btn-primary flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  Ver recomendación
                  <CheckCircle className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!currentAnswer}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              Siguiente
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
