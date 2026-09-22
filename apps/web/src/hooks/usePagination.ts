import { useEffect, useMemo, useState } from 'react'

interface UsePaginationResult<T> {
  page: number
  setPage: (page: number) => void
  pageItems: T[]
  totalPages: number
  totalItems: number
  pageSize: number
}

/**
 * Paginación en cliente reutilizable.
 *
 * @param items   Lista completa a paginar.
 * @param pageSize Cantidad de elementos por página.
 * @param resetKey Cambia este valor (p. ej. el filtro) para volver a la página 1.
 */
export function usePagination<T>(items: T[], pageSize = 10, resetKey?: unknown): UsePaginationResult<T> {
  const [page, setPage] = useState(1)

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // Volver a la página 1 cuando cambia el filtro/búsqueda.
  useEffect(() => {
    setPage(1)
  }, [resetKey])

  // Si la lista se reduce (p. ej. tras eliminar), no quedarse en una página vacía.
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  return { page, setPage, pageItems, totalPages, totalItems, pageSize }
}
