import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Permite el acceso al panel de revisión a revisores y administradores.
 * Cualquier otro rol es redirigido a su portal correspondiente.
 */
export default function ReviewerRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user?.role !== 'reviewer' && user?.role !== 'admin' && !user?.is_reviewer) {
    if (user?.role === 'doctor') {
      return <Navigate to={user.doctor_status === 'approved' ? '/doctor' : '/doctor/pending'} replace />
    }
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
