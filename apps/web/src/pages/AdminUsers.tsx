import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, MoreVertical, Pencil, RefreshCcw, Save, Trash2, UserPlus, X } from 'lucide-react'

import {
  AdminUser,
  AdminUserRole,
  createAdminUser,
  deleteAdminUser,
  getAdminUsers,
  updateAdminUser,
} from '../api/admin'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import Pagination from '../components/Pagination'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import { Input, PasswordInput, Select } from '../components/ui/Field'
import { getApiErrorMessage } from '../utils/apiError'
import { usePagination } from '../hooks/usePagination'

const ROLE_OPTIONS: AdminUserRole[] = ['patient', 'doctor', 'admin']
// Opciones del filtro: los roles y, además, la capacidad de revisor.
const FILTER_OPTIONS: Array<'all' | AdminUserRole> = ['all', 'patient', 'doctor', 'reviewer', 'admin']

const isFilterRole = (value: string | null): value is 'all' | AdminUserRole =>
  value !== null && (FILTER_OPTIONS as readonly string[]).includes(value)

const ROLE_LABELS: Record<AdminUserRole, string> = {
  patient: 'Paciente',
  doctor: 'Médico',
  reviewer: 'Revisor',
  admin: 'Administrador',
}

const ROLE_BADGES: Record<AdminUserRole, string> = {
  patient: 'bg-slate-200 text-slate-800',
  doctor: 'bg-emerald-100 text-emerald-800',
  reviewer: 'bg-violet-100 text-violet-800',
  admin: 'bg-sky-100 text-sky-800',
}

const DOCTOR_STATUS_LABELS: Record<string, string> = {
  pending: 'perfil pendiente',
  approved: 'perfil aprobado',
  rejected: 'perfil rechazado',
  suspended: 'perfil suspendido',
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
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

  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<AdminUserRole>('patient')
  const [createIsReviewer, setCreateIsReviewer] = useState(false)
  const [creating, setCreating] = useState(false)

  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<AdminUserRole>('patient')
  const [editIsReviewer, setEditIsReviewer] = useState(false)
  const [editPassword, setEditPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)
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
        role: roleFilter === 'all' || roleFilter === 'reviewer' ? undefined : roleFilter,
        is_reviewer: roleFilter === 'reviewer' ? true : undefined,
        search: search.trim() || undefined,
        limit: 100,
      })
      setUsers(response.users)
      setTotal(response.total)
      setSelected((current) => {
        if (!current) return null
        return response.users.find((item) => item.id === current.id) || null
      })
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar los usuarios'))
    } finally {
      setLoading(false)
    }
  }, [roleFilter, search])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Permite entrar con un filtro por URL (p. ej. /admin/users?role=doctor).
  useEffect(() => {
    const role = searchParams.get('role')
    if (isFilterRole(role)) {
      setRoleFilter(role)
    }
  }, [searchParams])

  // Cierra el menú de acciones al hacer clic fuera de él.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('[data-user-menu]')) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const created = await createAdminUser({
        email: createEmail.trim(),
        password: createPassword,
        role: createRole,
        is_reviewer: createIsReviewer,
      })
      setUsers((current) => [created, ...current])
      setTotal((current) => current + 1)
      setCreateEmail('')
      setCreatePassword('')
      setCreateRole('patient')
      setCreateIsReviewer(false)
      toast.success(`Usuario creado: ${created.email} (${ROLE_LABELS[created.role]})`)
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'No se pudo crear el usuario'))
    } finally {
      setCreating(false)
    }
  }

  const handleSelect = (item: AdminUser) => {
    setSelected(item)
    setEditEmail(item.email)
    setEditRole(item.role)
    setEditIsReviewer(item.is_reviewer)
    setEditPassword('')
    setError(null)
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateAdminUser(selected.id, {
        email: editEmail.trim() !== selected.email ? editEmail.trim() : undefined,
        role: editRole !== selected.role ? editRole : undefined,
        is_reviewer: editIsReviewer !== selected.is_reviewer ? editIsReviewer : undefined,
        password: editPassword || undefined,
      })
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setSelected(updated)
      setEditPassword('')
      toast.success(`Usuario actualizado: ${updated.email}`)
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'No se pudo actualizar el usuario'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const target = pendingDelete
      await deleteAdminUser(target.id)
      setUsers((current) => current.filter((entry) => entry.id !== target.id))
      setTotal((current) => Math.max(0, current - 1))
      if (selected?.id === target.id) {
        setSelected(null)
      }
      toast.success(`Usuario eliminado: ${target.email}`)
      setPendingDelete(null)
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'No se pudo eliminar el usuario'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-sky-700">Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Usuarios</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Crea, consulta, edita y elimina cuentas de pacientes, revisores y administradores. Los médicos se
          generan desde el flujo de postulación y aquí puedes gestionar su rol y estado.
        </p>

        <form onSubmit={handleCreate} className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto] lg:items-end">
          <Input
            label="Email"
            type="email"
            value={createEmail}
            onChange={(event) => setCreateEmail(event.target.value)}
            placeholder="usuario@clinica.com"
            autoComplete="off"
            required
          />
          <PasswordInput
            label="Contraseña"
            value={createPassword}
            onChange={(event) => setCreatePassword(event.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <Select
            label="Rol"
            value={createRole}
            onChange={(event) => setCreateRole(event.target.value as AdminUserRole)}
          >
            {ROLE_OPTIONS.filter((role) => role !== 'doctor').map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
          <Button type="submit" loading={creating} leftIcon={<UserPlus className="h-4 w-4" />}>
            Crear
          </Button>
        </form>
        <label className="mt-3 flex items-center gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={createIsReviewer}
            onChange={(event) => setCreateIsReviewer(event.target.checked)}
            className="h-4 w-4"
          />
          Dar acceso de revisión (revisor)
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Para médicos: la cuenta se crea al completar la postulación; luego puedes cambiar su rol y marcar
          "Acceso de revisión" aquí.
        </p>
      </section>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <Input
                  label="Buscar"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Email..."
                />
              </div>
              <Select
                label="Rol"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as 'all' | AdminUserRole)}
                className="w-auto min-w-[160px]"
                containerClassName="lg:w-auto"
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'Todos' : ROLE_LABELS[option]}
                  </option>
                ))}
              </Select>
            </div>
            <button type="button"
              onClick={loadUsers}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-950"
            >
              <RefreshCcw className="h-4 w-4" />
              Recargar
            </button>
          </div>

          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">{total} usuarios</p>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="flex min-h-[200px] items-center justify-center text-slate-500">
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Cargando usuarios...
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center text-slate-500">
                No hay usuarios para este filtro.
              </div>
            ) : (
              <>
                {pageItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col gap-3 rounded-2xl border p-4 transition-colors md:flex-row md:items-center md:justify-between ${
                    selected?.id === item.id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.full_name || item.email}</p>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${ROLE_BADGES[item.role]}`}>
                        {ROLE_LABELS[item.role]}
                      </span>
                      {item.is_reviewer && (
                        <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-medium text-violet-800">
                          Revisor
                        </span>
                      )}
                      {item.doctor_status && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-medium text-amber-800">
                          {DOCTOR_STATUS_LABELS[item.doctor_status] || item.doctor_status}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                      Alta: {new Date(item.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <div className="relative flex-none" data-user-menu>
                    <button type="button"
                      onClick={() => setOpenMenuId((current) => (current === item.id ? null : item.id))}
                      className="rounded-full border border-slate-300 p-2 text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900"
                      aria-label={`Acciones para ${item.email}`}
                      aria-haspopup="true"
                      aria-expanded={openMenuId === item.id}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {openMenuId === item.id && (
                      <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
                        <button type="button"
                          onClick={() => {
                            setOpenMenuId(null)
                            handleSelect(item)
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <Pencil className="h-4 w-4 text-slate-500" />
                          Editar
                        </button>

                        <div className="my-1 border-t border-slate-100" />

                        <button type="button"
                          onClick={() => {
                            setOpenMenuId(null)
                            setPendingDelete(item)
                          }}
                          disabled={currentUser?.id === item.id}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {!selected ? (
            <div className="flex min-h-[280px] items-center justify-center text-center text-slate-500">
              Selecciona “Editar” en un usuario para modificar su email, rol o contraseña.
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-sky-700">Editar usuario</p>
                  <p className="mt-1 text-sm text-slate-500">#{selected.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-slate-400"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <Input
                label="Email"
                type="email"
                value={editEmail}
                onChange={(event) => setEditEmail(event.target.value)}
                required
              />

              <div>
                <Select
                  label="Rol"
                  value={editRole}
                  onChange={(event) => setEditRole(event.target.value as AdminUserRole)}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </Select>
                {editRole === 'doctor' && !selected.doctor_status && (
                  <p className="mt-2 text-xs text-amber-700">
                    Este usuario no tiene perfil médico; no se puede asignar el rol médico todavía.
                  </p>
                )}
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900">
                <input
                  type="checkbox"
                  checked={editIsReviewer}
                  onChange={(event) => setEditIsReviewer(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Acceso de revisión</span>
                  <span className="mt-0.5 block text-xs text-violet-700">
                    Permite revisar y aprobar/rechazar postulaciones médicas, sin cambiar su rol principal
                    (puede ser médico y revisor a la vez).
                  </span>
                </span>
              </label>

              <PasswordInput
                label="Nueva contraseña"
                value={editPassword}
                onChange={(event) => setEditPassword(event.target.value)}
                placeholder="Dejar en blanco para no cambiar"
                autoComplete="new-password"
                minLength={8}
                hint="Déjala en blanco para no cambiarla"
              />

              <Button type="submit" loading={saving} leftIcon={<Save className="h-4 w-4" />} className="w-full">
                Guardar cambios
              </Button>
            </form>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title="¿Eliminar usuario?"
        description={
          pendingDelete
            ? `Se eliminará definitivamente a ${pendingDelete.email}. Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
