import { useState, useEffect } from 'react'
import { Loader2, Send, History } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
// IMPORTANTE: Asegúrate de importar TriageResponse
import { submitTriage, getTriageHistory, TriageResult, TriageResponse } from '../api/triage'
import TriageResultCard from '../components/TriageResultCard'
import BackButton from '../components/BackButton'

export default function Triage() {
  const { user } = useAuth() 

  const [symptomsText, setSymptomsText] = useState('')
  const [age, setAge] = useState<string>('')
  const [sex, setSex] = useState<string>('')
  
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TriageResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // CORRECCIÓN 1: El estado ahora es un array de TriageResponse
  const [history, setHistory] = useState<TriageResponse[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const loadHistory = async () => {
    if (!user?.id) return
    
    setLoadingHistory(true)
    try {
      const data = await getTriageHistory(user.id)
      setHistory(data)
    } catch (err) {
      console.error('Error cargando historial:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [user])

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
        sex: sex || undefined
      })
      
      setResult(response.result)
      loadHistory()
      
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

      {user && history.length > 0 && (
        <div className="mt-12 border-t pt-8">
          <div className="flex items-center gap-2 mb-6">
            <History className="w-6 h-6 text-gray-600" />
            <h2 className="text-2xl font-bold text-gray-800">Últimas Consultas</h2>
          </div>
          
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item, index) => (
                <div 
                  key={index} 
                  className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer" 
                  // CORRECCIÓN 3: Pasamos item.result a setResult
                  onClick={() => setResult(item.result)} 
                >
                  <p className="text-sm text-gray-500 mb-2">
                    {/* Al usar TriageResponse, created_at ya no da error de TypeScript */}
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Consulta anterior'}
                  </p>
                  
                  {/* CORRECCIÓN 4: Como symptoms_text no viene del backend, mostramos la especialidad */}
                  <p className="text-gray-800 font-medium mb-1">
                    Especialidad recomendada: <span className="capitalize">{item.result.recommended_specialty_slug.replace('-', ' ')}</span>
                  </p>

                  <div className="mt-3 flex gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      item.result.urgency === 'emergency' ? 'bg-red-100 text-red-700' :
                      item.result.urgency === 'high' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {item.result.urgency === 'emergency'
                      ? '⚠️ EMERGENCIA'
                      : `Urgencia ${
                          item.result.urgency === 'low'
                            ? 'Baja'
                            : item.result.urgency === 'medium'
                            ? 'Media'
                            : 'Alta'
                        }`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}