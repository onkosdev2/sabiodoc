import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { hasAnyRole, hasRole } from '../../utils/roles'

/**
 * Acceso al panel de soporte: rol «Soporte» y administradores.
 * Permite ver usuarios y su vista de soporte, sin editar nada.
 */
export default function SupportRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!hasAnyRole(user, 'support', 'admin')) {
    if (hasRole(user, 'doctor')) {
      return <Navigate to={user?.doctor_status === 'approved' ? '/doctor' : '/doctor/pending'} replace />
    }
    if (hasRole(user, 'reviewer')) {
      return <Navigate to="/reviewer/doctor-applications" replace />
    }
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
