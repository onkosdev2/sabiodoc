import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { getSectionHomePath } from '../utils/homePath'

interface BackButtonProps {
  to?: string
  label?: string
  /**
   * Si es true y hay historial en la app, vuelve a la página anterior en lugar
   * del destino fijo (útil en las páginas de autenticación).
   */
  useHistoryBack?: boolean
}

export default function BackButton({ to, label = 'Volver al menú', useHistoryBack = false }: BackButtonProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Destino de respaldo si no hay historial en la app: depende de la sección
  // actual (portal de paciente o panel profesional), no solo del rol.
  const destination = to ?? getSectionHomePath(location.pathname, user)

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (useHistoryBack && to === undefined && location.key !== 'default') {
      event.preventDefault()
      navigate(-1)
    }
  }

  return (
    <Link
      to={destination}
      onClick={handleClick}
      className="inline-flex items-center gap-2 text-slate-600 hover:text-primary-600 transition-colors mb-6"
    >
      <ArrowLeft className="w-5 h-5" />
      <span>{label}</span>
    </Link>
  )
}
