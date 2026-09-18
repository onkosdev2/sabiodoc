import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'

import { login } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import BackButton from '../components/BackButton'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import { Input, PasswordInput } from '../components/ui/Field'
import { getApiErrorMessage } from '../utils/apiError'

interface FieldErrors {
  email?: string
  password?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const validate = (): boolean => {
    const next: FieldErrors = {}
    if (!email.trim()) next.email = 'Ingresa tu correo.'
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = 'El correo no parece válido.'
    if (!password) next.password = 'Ingresa tu contraseña.'
    else if (password.length < 6) next.password = 'Debe tener al menos 6 caracteres.'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!validate()) return

    setLoading(true)
    try {
      const response = await login(email.trim(), password)
      authLogin(response.access_token, response.user)
      if (response.user.doctor_status === 'approved') {
        navigate('/doctor')
      } else if (response.user.role === 'admin') {
        navigate('/admin')
      } else if (response.user.is_reviewer || response.user.role === 'reviewer') {
        navigate('/reviewer/doctor-applications')
      } else if (response.user.role === 'doctor') {
        navigate('/doctor/pending')
      } else {
        navigate('/')
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No pudimos iniciar sesión. Revisa tus datos.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <BackButton useHistoryBack />

      <div className="card">
        <h1 className="mb-6 text-center text-2xl font-bold text-slate-800">Iniciar sesión</h1>

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
            autoComplete="current-password"
            required
            error={fieldErrors.password}
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
      </div>
    </div>
  )
}
