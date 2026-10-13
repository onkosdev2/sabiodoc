import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LifeBuoy, Loader2, RefreshCcw } from 'lucide-react'

import { AdminUser, AdminUserRole, getAdminUsers } from '../api/admin'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import { ROLE_LABELS } from '../utils/roles'
import { DOCTOR_STATUS_LABELS } from '../utils/statusLabels'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Input, Select } from '../components/ui/Field'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/Pagination'
import { usePagination } from '../hooks/usePagination'

const FILTER_OPTIONS: Array<'all' | AdminUserRole> = ['all', 'patient', 'doctor', 'reviewer', 'support', 'admin']

const isFilterRole = (value: string | null): value is 'all' | AdminUserRole =>
  value !== null && (FILTER_OPTIONS as readonly string[]).includes(value)

const ROLE_BADGES: Record<AdminUserRole, string> = {
  patient: 'bg-slate-200 text-slate-800',
  doctor: 'bg-emerald-100 text-emerald-800',
  reviewer: 'bg-violet-100 text-violet-800',
  support: 'bg-amber-100 text-amber-800',
  admin: 'bg-sky-100 text-sky-800',
}

export default function SupportUsers() {
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [roleFilter, setRoleFilter] = useState<'all' | AdminUserRole>(() => {
    const role = searchParams.get('role')
    return isFilterRole(role) ? role : 'all'
  })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { page, setPage, pageItems, totalPages, totalItems, pageSize } = usePagination(
    users,
    10,
    `${roleFilter}-${search}`,
  )

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getAdminUsers({
        role: roleFilter === 'all' ? undefined : roleFilter,
        search: search.trim() || undefined,
        limit: 100,
      })
      setUsers(response.users)
      setTotal(response.total)
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'No se pudieron cargar los usuarios')
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [roleFilter, search, toast])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LifeBuoy}
        title="Usuarios"
        description="Consulta usuarios y abre su vista de soporte para diagnosticar incidencias. Este panel es de solo lectura."
        actions={
          <Button
            variant="secondary"
            onClick={loadUsers}
            disabled={loading}
            leftIcon={<RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Recargar
          </Button>
        }
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Buscar"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="correo@clinica.com"
            />
          </div>
          <Select
            label="Rol"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as 'all' | AdminUserRole)}
            className="w-auto min-w-[160px]"
            containerClassName="sm:w-auto"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'Todos' : ROLE_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>

        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">{total} usuarios</p>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center text-slate-500">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              Cargando usuarios...
            </div>
          ) : error ? (
            <Alert tone="danger">{error}</Alert>
          ) : users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center text-slate-500">
              No hay usuarios para este filtro.
            </div>
          ) : (
            <>
              {pageItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/support/users/${item.id}`)}
                  className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-amber-300 hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {item.full_name || item.email}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {item.email} · Registro: {new Date(item.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.roles.map((role) => (
                      <span
                        key={role}
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${ROLE_BADGES[role]}`}
                      >
                        {ROLE_LABELS[role]}
                      </span>
                    ))}
                    {item.doctor_status && (
                      <Badge tone="info">{DOCTOR_STATUS_LABELS[item.doctor_status] || 'Sin perfil'}</Badge>
                    )}
                  </div>
                </button>
              ))}
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </section>
    </div>
  )
}
