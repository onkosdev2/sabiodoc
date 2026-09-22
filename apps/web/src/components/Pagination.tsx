import { ChevronLeft, ChevronRight } from 'lucide-react'

import Button from './ui/Button'

interface PaginationProps {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  className?: string
}

/**
 * Controles de paginación consistentes para listados.
 * No renderiza nada si todos los elementos caben en una sola página.
 */
export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className = '',
}: PaginationProps) {
  if (totalItems <= pageSize || totalPages <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return (
    <nav
      aria-label="Paginación"
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 ${className}`.trim()}
    >
      <p className="text-sm text-slate-500">
        Mostrando <span className="font-medium text-slate-700">{start}–{end}</span> de{' '}
        <span className="font-medium text-slate-700">{totalItems}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          leftIcon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />}
        >
          <span className="hidden sm:inline">Anterior</span>
        </Button>
        <span className="px-1 text-sm text-slate-600">
          Página {page} de {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
          rightIcon={<ChevronRight className="h-4 w-4" aria-hidden="true" />}
        >
          <span className="hidden sm:inline">Siguiente</span>
        </Button>
      </div>
    </nav>
  )
}
