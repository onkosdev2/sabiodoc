import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'

import { register } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import BackButton from '../components/BackButton'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import { Input, PasswordInput } from '../components/ui/Field'
import { getApiErrorMessage } from '../utils/apiError'

interface FieldErrors {
  email?: string
  password?: string
  confirmPassword?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Register() {
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const validate = (): boolean => {
    const next: FieldErrors = {}
    if (!email.trim()) next.email = 'Ingresa tu correo.'
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = 'El correo no parece válido.'
    if (!password) next.password = 'Ingresa una contraseña.'
    else if (password.length < 6) next.password = 'Debe tener al menos 6 caracteres.'
    if (confirmPassword !== password) next.confirmPassword = 'Las contraseñas no coinciden.'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!validate()) return

    setLoading(true)
    try {
      const response = await register(email.trim(), password)
      authLogin(response.access_token, response.user)
      navigate('/')
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No pudimos crear tu cuenta. Intenta de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <BackButton useHistoryBack />

      <div className="card">
        <h1 className="mb-6 text-center text-2xl font-bold text-slate-800">Crear cuenta</h1>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@email.com"
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
            autoComplete="new-password"
            required
            hint="Mínimo 6 caracteres"
            error={fieldErrors.password}
          />

          <PasswordInput
            label="Confirmar contraseña"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
            error={fieldErrors.confirmPassword}
          />

          {error && <Alert tone="danger">{error}</Alert>}

          <Button type="submit" size="lg" loading={loading} leftIcon={<UserPlus className="h-5 w-5" />} className="w-full">
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </Button>
        </form>

        <p className="mt-6 text-center text-slate-600">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" replace className="font-medium text-primary-600 hover:underline">
            Inicia sesión
          </Link>
        </p>

        <p className="mt-4 text-center text-sm text-slate-500">
          ¿Eres un profesional de la salud?{' '}
          <Link to="/doctor/apply" replace className="font-medium text-primary-600 hover:underline">
            Postula como médico aquí
          </Link>
        </p>
      </div>
    </div>
  )
}
