import { Star } from 'lucide-react'

import { cn } from '../utils/cn'

interface DoctorFavoriteButtonProps {
  doctorId: number
  active: boolean
  onToggle: (doctorId: number) => void
  disabled?: boolean
  className?: string
}

/** Botón de "favorito" para un médico, reutilizable en listados y perfil. */
export default function DoctorFavoriteButton({
  doctorId,
  active,
  onToggle,
  disabled,
  className,
}: DoctorFavoriteButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        // Evita que el clic navegue si el botón va sobre una tarjeta enlazada.
        event.preventDefault()
        event.stopPropagation()
        onToggle(doctorId)
      }}
      disabled={disabled}
      aria-label={active ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      aria-pressed={active}
      title={active ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      className={cn(
        'rounded-full bg-white/90 p-2 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-white',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50',
        active ? 'text-yellow-500' : 'text-slate-400 hover:text-yellow-500',
        className,
      )}
    >
      <Star className={cn('h-5 w-5', active && 'fill-current')} aria-hidden="true" />
    </button>
  )
}
