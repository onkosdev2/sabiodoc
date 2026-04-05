import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function PatientRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role === 'doctor') {
    return <Navigate to="/doctor" replace />
  }

  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}
