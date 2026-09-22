import { ChevronDown } from 'lucide-react'

import Button from './ui/Button'

interface SummaryToggleButtonProps {
  expanded: boolean
  onClick: () => void
  collapsedLabel?: string
  expandedLabel?: string
  /** 'sm' para espacios reducidos (paneles laterales); 'md' para contenido principal. */
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Botón unificado para mostrar/ocultar el detalle de un resumen clínico.
 * Mismo estilo (`btn-secondary`) y comportamiento en toda la aplicación.
 */
export default function SummaryToggleButton({
  expanded,
  onClick,
  collapsedLabel = 'Ver resumen',
  expandedLabel = 'Ocultar resumen',
  size = 'md',
  className = '',
}: SummaryToggleButtonProps) {
  const sizeClasses = size === 'sm' ? 'text-xs' : ''

  return (
    <Button
      variant="secondary"
      size={size}
      onClick={onClick}
      aria-expanded={expanded}
      leftIcon={
        <ChevronDown
          className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      }
      className={`${sizeClasses} ${className}`.trim()}
    >
      {expanded ? expandedLabel : collapsedLabel}
    </Button>
  )
}
