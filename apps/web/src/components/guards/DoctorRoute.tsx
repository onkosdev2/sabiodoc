import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function DoctorRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'doctor') {
    return <Navigate to="/" replace />
  }

  if (user?.doctor_status !== 'approved') {
    return <Navigate to="/doctor/pending" replace />
  }

  return <Outlet />
}
