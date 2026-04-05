import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, UserPlus } from 'lucide-react'
import { register } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import BackButton from '../components/BackButton'

export default function Register() {
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await register(email, password)
      authLogin(response.access_token, response.user)
      navigate('/')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <BackButton />
      
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Crear Cuenta
        </h1>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
              placeholder="tu@email.com"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
              placeholder="••••••••"
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">
              Confirmar Contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field"
              required
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Crear Cuenta
              </>
            )}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-primary-600 hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>

        <div className="mt-6 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4 text-sm text-primary-800">
          ¿Eres médico? Usa el onboarding profesional en{' '}
          <Link to="/doctor/apply" className="font-semibold hover:underline">
            /doctor/apply
          </Link>
          .
        </div>
      </div>
    </div>
  )
}
