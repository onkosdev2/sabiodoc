import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'

import { login } from '../api/auth'
import { getMyPatientProfile } from '../api/patients'
import { useAuth } from '../context/AuthContext'
import BackButton from '../components/BackButton'
import CheckEmailNotice from '../components/CheckEmailNotice'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import Checkbox from '../components/ui/Checkbox'
import { Input, PasswordInput } from '../components/ui/Field'
import { getApiErrorMessage } from '../utils/apiError'
import { focusFirstInvalid } from '../utils/forms'
import { hasRole } from '../utils/roles'
import { isPatientProfileIncomplete } from '../utils/patientProfileFields'

interface FieldErrors {
  email?: string
  password?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** A un paciente sin datos lo llevamos a completar su perfil; si ya lo tiene, al portal. */
async function getPatientLandingPath(): Promise<string> {
  try {
    const profile = await getMyPatientProfile()
    return isPatientProfileIncomplete(profile) ? '/me/profile' : '/'
  } catch {
    return '/'
  }
}

export default function Login() {
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const formRef = useRef<HTMLFormElement>(null)

  const validate = (): boolean => {
    const next: FieldErrors = {}
    if (!email.trim()) next.email = 'Ingresa tu correo.'
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = 'El correo no parece válido.'
    if (!password) next.password = 'Ingresa tu contraseña.'
    else if (password.length < 6) next.password = 'Debe tener al menos 6 caracteres.'
    setFieldErrors(next)
    if (Object.keys(next).length > 0) {
      focusFirstInvalid(formRef.current)
      return false
    }
    return true
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!validate()) return

    setLoading(true)
    try {
      const response = await login(email.trim(), password)
      authLogin(response.access_token, response.user, remember)
      if (response.user.doctor_status === 'approved') {
        navigate('/doctor')
      } else if (hasRole(response.user, 'admin')) {
        navigate('/admin')
      } else if (hasRole(response.user, 'reviewer')) {
        navigate('/reviewer/doctor-applications')
      } else if (hasRole(response.user, 'support')) {
        navigate('/support/tickets')
      } else if (hasRole(response.user, 'doctor')) {
        navigate('/doctor/pending')
      } else {
        navigate(await getPatientLandingPath())
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        setUnverifiedEmail(email.trim())
        return
      }
      setError(getApiErrorMessage(err, 'No pudimos iniciar sesión. Revisa tus datos.'))
    } finally {
      setLoading(false)
    }
  }

  if (unverifiedEmail) {
    return (
      <div className="mx-auto max-w-md">
        <BackButton useHistoryBack />
        <div className="card">
          <CheckEmailNotice email={unverifiedEmail} />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <BackButton useHistoryBack />

      <div className="card">
        <h1 className="mb-6 text-center text-2xl font-bold text-slate-800">Iniciar sesión</h1>

        <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tucorreo@ejemplo.com"
            autoComplete="email"
            autoFocus
            required
            error={fieldErrors.email}
          />

          <PasswordInput
            label="Contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            error={fieldErrors.password}
          />

          <Checkbox
            label="Recordarme"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />

          {error && <Alert tone="danger">{error}</Alert>}

          <Button type="submit" size="lg" loading={loading} leftIcon={<LogIn className="h-5 w-5" />} className="w-full">
            {loading ? 'Iniciando...' : 'Iniciar sesión'}
          </Button>
        </form>

        <p className="mt-6 text-center text-slate-600">
          ¿No tienes cuenta?{' '}
          <Link to="/register" replace className="font-medium text-primary-600 hover:underline">
            Regístrate
          </Link>
        </p>

        <p className="mt-3 text-center text-sm">
          <Link to="/forgot-password" replace className="font-medium text-primary-600 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </div>
    </div>
  )
}
