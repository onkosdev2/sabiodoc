import { cn } from '../../utils/cn'

interface SkeletonProps {
  className?: string
}

/** Bloque de carga (mejor que un spinner genérico para listas/tarjetas). */
export default function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className={cn('skeleton h-4', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}
