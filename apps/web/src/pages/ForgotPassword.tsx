import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, MailCheck } from 'lucide-react'

import { forgotPassword } from '../api/auth'
import BackButton from '../components/BackButton'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { getApiErrorMessage } from '../utils/apiError'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | undefined>()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError('El correo no parece válido.')
      return
    }
    setEmailError(undefined)
    setLoading(true)
    setError(null)
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No pudimos procesar la solicitud. Intenta de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <BackButton useHistoryBack />

      <div className="card">
        {sent ? (
          <div className="text-center">
            <MailCheck className="mx-auto h-12 w-12 text-emerald-500" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-slate-800">Revisa tu correo</h1>
            <p className="mt-2 text-sm text-slate-600">
              Si <span className="font-medium">{email}</span> está registrado, recibirás un enlace para
              restablecer tu contraseña. Revisa también la carpeta de spam.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex font-medium text-primary-600 hover:underline"
            >
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <KeyRound className="h-6 w-6 text-primary-600" aria-hidden="true" />
              <h1 className="text-2xl font-bold text-slate-800">Recuperar contraseña</h1>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Escribe el correo con el que te registraste y te enviaremos un enlace para crear una
              contraseña nueva.
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              <Input
                label="Correo electrónico"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                autoFocus
                required
                error={emailError}
              />

              {error && <Alert tone="danger">{error}</Alert>}

              <Button type="submit" size="lg" loading={loading} className="w-full">
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              ¿Recordaste tu contraseña?{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:underline">
                Inicia sesión
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
