import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, KeyRound, Lock, ShieldCheck } from 'lucide-react'

import { changePassword } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../utils/apiError'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import { PasswordInput } from '../components/ui/Field'

interface FieldErrors {
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
}

/** Política mínima de contraseñas, alineada con el backend. */
function validateNewPassword(value: string): string | undefined {
  if (value.length < 8) return 'Debe tener al menos 8 caracteres.'
  if (!/[A-Za-z]/.test(value)) return 'Debe incluir al menos una letra.'
  if (!/\d/.test(value)) return 'Debe incluir al menos un número.'
  return undefined
}

/**
 * Cambio de contraseña para cualquier usuario autenticado (paciente, médico,
 * admin o revisor). Al cambiarla se revocan las demás sesiones y se envía un
 * correo de confirmación.
 */
export default function SecuritySettings() {
  const { updateToken } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const next: FieldErrors = {}
    if (!currentPassword) next.currentPassword = 'Ingresa tu contraseña actual.'
    const newPasswordError = validateNewPassword(newPassword)
    if (newPasswordError) next.newPassword = newPasswordError
    if (newPassword && newPassword === currentPassword) {
      next.newPassword = 'La nueva contraseña debe ser distinta a la actual.'
    }
    if (confirmPassword !== newPassword) next.confirmPassword = 'Las contraseñas no coinciden.'
    setFieldErrors(next)
    if (Object.keys(next).length > 0) return

    setLoading(true)
    try {
      const response = await changePassword(currentPassword, newPassword)
      // El backend revoca las demás sesiones y devuelve un token nuevo.
      updateToken(response.access_token)
      setSuccess(response.message)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setFieldErrors({})
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No se pudo cambiar la contraseña. Intenta de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="Seguridad"
        description="Actualiza tu contraseña. Recomendamos usar una distinta a la de otros sitios."
      />

      <Card>
        {success ? (
          <div className="text-center" role="status">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold text-slate-900">Contraseña actualizada</h2>
            <p className="mt-2 text-sm text-slate-600">{success}</p>
            <p className="mt-1 text-sm text-slate-500">
              Te enviamos un correo de confirmación. Si no reconoces este cambio, restablece tu
              contraseña de inmediato.
            </p>
            <Button className="mt-6" variant="secondary" onClick={() => setSuccess(null)}>
              Cambiar otra vez
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-slate-900">Cambiar contraseña</h2>
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              <PasswordInput
                label="Contraseña actual"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                error={fieldErrors.currentPassword}
              />
              <PasswordInput
                label="Nueva contraseña"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                hint="Mínimo 8 caracteres, con al menos una letra y un número."
                error={fieldErrors.newPassword}
              />
              <PasswordInput
                label="Confirmar nueva contraseña"
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

            <p className="mt-4 text-center text-sm text-slate-500">
              ¿No recuerdas tu contraseña actual?{' '}
              <Link to="/forgot-password" className="font-medium text-primary-600 hover:underline">
                Recupérala por correo
              </Link>
            </p>
          </>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-slate-800">
          <Lock className="h-5 w-5 text-slate-500" aria-hidden="true" />
          <h2 className="text-base font-semibold">Cómo protegemos tu cuenta</h2>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            Al cambiar tu contraseña, cerramos las demás sesiones abiertas.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            Te enviamos un correo de confirmación en cada cambio.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            Cualquier enlace de restablecimiento pendiente deja de ser válido.
          </li>
        </ul>
      </Card>
    </div>
  )
}
