import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { submitTriage, TriageResult } from '../api/triage'
import TriageResultCard from '../components/TriageResultCard'
import BackButton from '../components/BackButton'

export default function Triage() {
  const [symptomsText, setSymptomsText] = useState('')
  const [age, setAge] = useState<string>('')
  const [sex, setSex] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TriageResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (symptomsText.length < 10) {
      setError('Por favor, describe tus síntomas con más detalle (mínimo 10 caracteres)')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await submitTriage({
        symptoms_text: symptomsText,
        age: age ? parseInt(age) : undefined,
        sex: sex || undefined,
      })

      setResult(response.result)
    } catch (err) {
      setError('Error al procesar tu solicitud. Por favor, intenta de nuevo.')
      console.error('Triage error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setSymptomsText('')
    setAge('')
    setSex('')
    setResult(null)
    setError(null)
  }

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <BackButton />

      <h1 className="text-3xl font-bold text-gray-800 mb-2">
        🗣️ Describir Mi Caso
      </h1>
      <p className="text-gray-600 mb-6">
        Describe tus síntomas y nuestra IA te orientará hacia la especialidad médica más adecuada.
      </p>

      {!result ? (
        <form onSubmit={handleSubmit} className="card mb-8">
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">
              ¿Qué síntomas tienes? *
            </label>
            <textarea
              value={symptomsText}
              onChange={(e) => setSymptomsText(e.target.value)}
              placeholder="Describe tus síntomas..."
              className="input-field min-h-[150px] resize-y"
              required
              minLength={10}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-gray-700 font-medium mb-2">Edad (opcional)</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="input-field"
                min="0"
                max="150"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Sexo (opcional)</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="input-field"
              >
                <option value="">Seleccionar...</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
              </select>
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

          <button
            type="submit"
            disabled={loading || symptomsText.length < 10}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {loading ? 'Analizando...' : 'Analizar Síntomas'}
          </button>
        </form>
      ) : (
        <div className="mb-8">
          <TriageResultCard result={result} />
          <div className="mt-6 text-center">
            <button onClick={handleReset} className="btn-secondary">
              Hacer otra consulta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
