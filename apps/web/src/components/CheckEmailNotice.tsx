import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'

import { resendVerification } from '../api/auth'
import { getApiErrorMessage } from '../utils/apiError'
import Alert from './ui/Alert'
import Button from './ui/Button'

interface CheckEmailNoticeProps {
  email: string
  /** ``false`` si el backend no pudo enviar el correo de verificación. */
  emailSent?: boolean | null
}

/** Aviso "revisa tu correo" tras registrarse, con opción de reenviar el enlace. */
export default function CheckEmailNotice({ email, emailSent }: CheckEmailNoticeProps) {
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const deliveryFailed = emailSent === false

  const handleResend = async () => {
    setSending(true)
    setMessage(null)
    setError(null)
    try {
      const response = await resendVerification(email)
      setMessage(response.message)
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo reenviar el correo.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="text-center">
      <MailCheck className="mx-auto h-12 w-12 text-primary-600" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold text-slate-800">
        {deliveryFailed ? 'No pudimos enviar el correo' : 'Revisa tu correo'}
      </h1>
      {deliveryFailed ? (
        <Alert tone="warning" className="mt-4 text-left">
          Tu cuenta se creó correctamente, pero el enlace de verificación no pudo enviarse a{' '}
          <span className="font-medium">{email}</span>. Usa «Reenviar correo» en unos minutos. Si el
          problema continúa, contacta a soporte.
        </Alert>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600">
            Enviamos un enlace de verificación a{' '}
            <span className="font-medium text-slate-900">{email}</span>. Ábrelo para activar tu cuenta antes
            de iniciar sesión.
          </p>
          <p className="mt-2 text-xs text-slate-500">Si no lo ves, revisa la carpeta de spam.</p>
        </>
      )}

      {message && (
        <Alert tone="success" className="mt-4 text-left">
          {message}
        </Alert>
      )}
      {error && (
        <Alert tone="danger" className="mt-4 text-left">
          {error}
        </Alert>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={handleResend} loading={sending}>
          Reenviar correo
        </Button>
        <Link to="/login" replace className="btn-primary">
          Ir a iniciar sesión
        </Link>
      </div>
    </div>
  )
}
