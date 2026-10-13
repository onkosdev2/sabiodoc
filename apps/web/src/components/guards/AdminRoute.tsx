import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { hasRole } from '../../utils/roles'

export default function AdminRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!hasRole(user, 'admin')) {
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
