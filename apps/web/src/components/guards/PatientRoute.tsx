import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Rutas de paciente.
 *
 * Cualquier usuario autenticado puede actuar como paciente: un médico, un
 * revisor o un administrador conservan sus capacidades profesionales pero
 * también pueden agendar citas, guardar favoritos o ver su historial.
 */
export default function PatientRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
