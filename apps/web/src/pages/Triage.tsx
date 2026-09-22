import { useEffect, useState } from 'react'
import { Send, Stethoscope } from 'lucide-react'

import { submitTriage, TriageResult } from '../api/triage'
import { getMyPatientProfile } from '../api/patients'
import TriageResultCard from '../components/TriageResultCard'
import BackButton from '../components/BackButton'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { Input, Select, Textarea } from '../components/ui/Field'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../utils/apiError'

export default function Triage() {
  const { isAuthenticated } = useAuth()
  const [symptomsText, setSymptomsText] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('')
  const [profileDefaults, setProfileDefaults] = useState<{ age: string; sex: string }>({ age: '', sex: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TriageResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [symptomsError, setSymptomsError] = useState<string | undefined>()

  // Prellena edad y sexo con los datos del perfil del paciente, si existen.
  useEffect(() => {
    if (!isAuthenticated) return
    let active = true
    getMyPatientProfile()
      .then((profile) => {
        if (!active) return
        const defaults = {
          age: profile.age != null ? String(profile.age) : '',
          sex: profile.sex ?? '',
        }
        setProfileDefaults(defaults)
        // Respeta lo que el usuario ya haya escrito manualmente.
        setAge((current) => current || defaults.age)
        setSex((current) => current || defaults.sex)
      })
      .catch(() => {
        // Sin sesión o sin perfil: los campos quedan opcionales y vacíos.
      })
    return () => {
      active = false
    }
  }, [isAuthenticated])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (symptomsText.trim().length < 10) {
      setSymptomsError('Describe tus síntomas con al menos 10 caracteres.')
      return
    }
    setSymptomsError(undefined)
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await submitTriage({
        symptoms_text: symptomsText.trim(),
        age: age ? parseInt(age, 10) : undefined,
        sex: sex || undefined,
      })
      setResult(response.result)
    } catch (err) {
      setError(getApiErrorMessage(err, 'No pudimos procesar tu solicitud. Intenta de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setSymptomsText('')
    setAge(profileDefaults.age)
    setSex(profileDefaults.sex)
    setResult(null)
    setError(null)
    setSymptomsError(undefined)
  }

  return (
    <div className="mx-auto max-w-3xl pb-12">
      <BackButton />

      <PageHeader
        icon={Stethoscope}
        title="Describir mi caso"
        description="Describe tus síntomas y nuestra IA te orientará hacia la especialidad médica más adecuada."
        className="mb-6"
      />

      {!result ? (
        <form onSubmit={handleSubmit} noValidate className="card mb-8 space-y-6">
          <Textarea
            label="¿Qué síntomas tienes?"
            required
            value={symptomsText}
            onChange={(event) => setSymptomsText(event.target.value)}
            placeholder="Describe tus síntomas, desde cuándo los tienes y si algo los empeora..."
            className="min-h-[150px] resize-y"
            error={symptomsError}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Edad (opcional)"
              type="number"
              inputMode="numeric"
              min={0}
              max={150}
              value={age}
              onChange={(event) => setAge(event.target.value)}
            />
            <Select label="Sexo (opcional)" value={sex} onChange={(event) => setSex(event.target.value)}>
              <option value="">Sin especificar</option>
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="other">Otro</option>
            </Select>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          <Button
            type="submit"
            size="lg"
            loading={loading}
            leftIcon={<Send className="h-5 w-5" />}
            className="w-full"
          >
            {loading ? 'Analizando...' : 'Analizar síntomas'}
          </Button>
        </form>
      ) : (
        <div className="mb-8">
          <TriageResultCard result={result} />
          <div className="mt-6 text-center">
            <Button variant="secondary" onClick={handleReset}>
              Hacer otra consulta
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
