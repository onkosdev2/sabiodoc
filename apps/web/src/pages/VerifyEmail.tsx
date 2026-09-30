import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, MailWarning } from 'lucide-react'

import { resendVerification, verifyEmail } from '../api/auth'
import { getApiErrorMessage } from '../utils/apiError'
import Alert from '../components/ui/Alert'
import BackButton from '../components/BackButton'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Field'

type Status = 'loading' | 'success' | 'error'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('El enlace no es válido o está incompleto. Solicita uno nuevo.')
      return
    }
    let active = true
    verifyEmail(token)
      .then((response) => {
        if (!active) return
        setStatus('success')
        setMessage(response.message)
      })
      .catch((error) => {
        if (!active) return
        setStatus('error')
        setMessage(getApiErrorMessage(error, 'No se pudo verificar tu correo.'))
      })
    return () => {
      active = false
    }
  }, [token])

  const handleResend = async (event: React.FormEvent) => {
    event.preventDefault()
    setResending(true)
    setResendMessage(null)
    setResendError(null)
    try {
      const response = await resendVerification(email.trim())
      setResendMessage(response.message)
    } catch (error) {
      setResendError(getApiErrorMessage(error, 'No se pudo reenviar el correo.'))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <BackButton useHistoryBack />

      <div className="card text-center">
        {status === 'loading' && <p className="py-6 text-slate-600">Verificando tu correo…</p>}

        {status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-slate-800">Correo verificado</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            <Link to="/login" replace className="btn-primary mt-6 inline-flex">
              Iniciar sesión
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <MailWarning className="mx-auto h-12 w-12 text-amber-500" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-slate-800">No pudimos verificar tu correo</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            <form onSubmit={handleResend} className="mt-6 space-y-3 text-left">
              <Input
                label="Tu correo"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tucorreo@ejemplo.com"
                required
              />
              {resendMessage && <Alert tone="success">{resendMessage}</Alert>}
              {resendError && <Alert tone="danger">{resendError}</Alert>}
              <Button type="submit" loading={resending} className="w-full">
                Reenviar enlace
              </Button>
            </form>
            <Link
              to="/login"
              replace
              className="mt-4 inline-flex text-sm font-medium text-primary-600 hover:underline"
            >
              Volver a iniciar sesión
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
