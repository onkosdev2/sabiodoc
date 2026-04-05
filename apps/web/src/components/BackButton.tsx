import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
  to?: string
  label?: string
}

export default function BackButton({ to = '/', label = 'Volver al menú' }: BackButtonProps) {
  return (
    <Link 
      to={to}
      className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors mb-6"
    >
      <ArrowLeft className="w-5 h-5" />
      <span>{label}</span>
    </Link>
  )
}
