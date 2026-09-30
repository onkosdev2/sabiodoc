import type { ElementType, ReactNode } from 'react'

import { cn } from '../../utils/cn'

interface CardProps {
  children: ReactNode
  className?: string
  /** Identificador opcional (p. ej. para enlaces ancla). */
  id?: string
  /** Elemento semántico a renderizar (por defecto `div`). */
  as?: ElementType
}

/** Superficie base del design system. */
export default function Card({ children, className, id, as: Component = 'div' }: CardProps) {
  return <Component id={id} className={cn('card', className)}>{children}</Component>
}
