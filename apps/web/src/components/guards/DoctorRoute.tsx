import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Acceso al panel médico basado en capacidad, no en rol.
 *
 * Se permite si el usuario tiene un DoctorProfile (doctor_status no nulo),
 * aunque su rol principal sea reviewer o admin.
 */
export default function DoctorRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!user?.doctor_status) {
    if (user?.role === 'admin') {
      return <Navigate to="/admin" replace />
    }
    if (user?.role === 'reviewer') {
      return <Navigate to="/reviewer/doctor-applications" replace />
    }
    return <Navigate to="/" replace />
  }

  if (user.doctor_status !== 'approved') {
    return <Navigate to="/doctor/pending" replace />
  }

  return <Outlet />
}
