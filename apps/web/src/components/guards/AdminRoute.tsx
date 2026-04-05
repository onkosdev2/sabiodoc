import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function AdminRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'admin') {
    if (user?.role === 'doctor') {
      return <Navigate to={user.doctor_status === 'approved' ? '/doctor' : '/doctor/pending'} replace />
    }
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
