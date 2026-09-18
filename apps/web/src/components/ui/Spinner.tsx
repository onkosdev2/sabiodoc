import { Loader2 } from 'lucide-react'

import { cn } from '../../utils/cn'

const SIZES = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-10 w-10',
} as const

interface SpinnerProps {
  size?: keyof typeof SIZES
  className?: string
  label?: string
}

export default function Spinner({ size = 'md', className, label = 'Cargando' }: SpinnerProps) {
  return <Loader2 role="status" aria-label={label} className={cn('animate-spin text-primary-500', SIZES[size], className)} />
}
