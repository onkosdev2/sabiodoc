import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useNoIndex } from '../../utils/seo'

export default function AuthenticatedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  useNoIndex(isAuthenticated && !isLoading)

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
