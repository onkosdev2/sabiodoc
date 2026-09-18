import type { ReactNode } from 'react'

import { cn } from '../../utils/cn'

interface CardProps {
  children: ReactNode
  className?: string
}

/** Superficie base del design system. */
export default function Card({ children, className }: CardProps) {
  return <div className={cn('card', className)}>{children}</div>
}
