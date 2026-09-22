import type { ElementType, ReactNode } from 'react'

import { cn } from '../../utils/cn'

interface CardProps {
  children: ReactNode
  className?: string
  /** Elemento semántico a renderizar (por defecto `div`). */
  as?: ElementType
}

/** Superficie base del design system. */
export default function Card({ children, className, as: Component = 'div' }: CardProps) {
  return <Component className={cn('card', className)}>{children}</Component>
}
