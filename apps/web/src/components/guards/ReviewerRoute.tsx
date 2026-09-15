import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Permite el acceso al panel de revisión a revisores y administradores.
 * Cualquier otro rol es redirigido a su portal correspondiente.
 */
export default function ReviewerRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'reviewer' && user?.role !== 'admin') {
    if (user?.role === 'doctor') {
      return <Navigate to={user.doctor_status === 'approved' ? '/doctor' : '/doctor/pending'} replace />
    }
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
