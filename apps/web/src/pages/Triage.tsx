import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { focusFirstInvalid } from '../utils/forms'

export default function Triage() {
  const { isAuthenticated } = useAuth()
  const [symptomsText, setSymptomsText] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('')
  const [profileDefaults, setProfileDefaults] = useState<{ age: string; sex: string }>({ age: '', sex: '' })
  const [loading, setLoading] = useState(false)
  const [acceptedClinical, setAcceptedClinical] = useState(false)
  const [result, setResult] = useState<TriageResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [symptomsError, setSymptomsError] = useState<string | undefined>()
  const formRef = useRef<HTMLFormElement>(null)

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
      focusFirstInvalid(formRef.current)
      return
    }
    if (!acceptedClinical) {
      setError('Debes aceptar el tratamiento de tus datos clínicos para continuar.')
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
        accepted_clinical_data: acceptedClinical,
        consent_text_version: 'v1',
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
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="card mb-8 space-y-6">
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

          <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs text-sky-900">
            <p>
              Al analizar, tus síntomas se tratan para orientarte hacia una especialidad. No sustituye una
              consulta médica. Revisa la{' '}
              <Link to="/privacidad" className="font-medium underline">
                política de privacidad
              </Link>{' '}
              y la{' '}
              <Link to="/telemedicina" className="font-medium underline">
                política de telemedicina
              </Link>
              .
            </p>
            <label className="mt-2 flex items-start gap-2">
              <input
                type="checkbox"
                checked={acceptedClinical}
                onChange={(event) => setAcceptedClinical(event.target.checked)}
                className="mt-0.5"
              />
              <span>Acepto el tratamiento de mis datos clínicos para esta orientación.</span>
            </label>
          </div>

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
