import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, KeyRound } from 'lucide-react'

import { resetPassword } from '../api/auth'
import BackButton from '../components/BackButton'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import { PasswordInput } from '../components/ui/Field'
import { getApiErrorMessage } from '../utils/apiError'

interface FieldErrors {
  password?: string
  confirmPassword?: string
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const next: FieldErrors = {}
    if (password.length < 8) next.password = 'Debe tener al menos 8 caracteres.'
    if (confirmPassword !== password) next.confirmPassword = 'Las contraseñas no coinciden.'
    setFieldErrors(next)
    if (Object.keys(next).length > 0) return

    setLoading(true)
    setError(null)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'El enlace es inválido o expiró. Solicita uno nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <BackButton useHistoryBack />

      <div className="card">
        {!token ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800">Enlace inválido</h1>
            <p className="mt-2 text-sm text-slate-600">
              El enlace no incluye un token válido. Solicita uno nuevo.
            </p>
            <Link
              to="/forgot-password"
              className="mt-6 inline-flex font-medium text-primary-600 hover:underline"
            >
              Recuperar contraseña
            </Link>
          </div>
        ) : done ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-slate-800">Contraseña actualizada</h1>
            <p className="mt-2 text-sm text-slate-600">Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <Link
              to="/login"
              className="mt-6 inline-flex font-medium text-primary-600 hover:underline"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <KeyRound className="h-6 w-6 text-primary-600" aria-hidden="true" />
              <h1 className="text-2xl font-bold text-slate-800">Nueva contraseña</h1>
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              <PasswordInput
                label="Nueva contraseña"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                hint="Mínimo 8 caracteres"
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

              <Button type="submit" size="lg" loading={loading} className="w-full">
                {loading ? 'Guardando...' : 'Cambiar contraseña'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
