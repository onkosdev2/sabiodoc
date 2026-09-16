import { useCallback, useEffect, useState } from 'react'
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

const ROLE_OPTIONS: AdminUserRole[] = ['patient', 'doctor', 'admin']
// Opciones del filtro: los roles y, además, la capacidad de revisor.
const FILTER_OPTIONS: Array<'all' | AdminUserRole> = ['all', 'patient', 'doctor', 'reviewer', 'admin']

const ROLE_LABELS: Record<AdminUserRole, string> = {
  patient: 'Paciente',
  doctor: 'Médico',
  reviewer: 'Revisor',
  admin: 'Administrador',
}

const ROLE_BADGES: Record<AdminUserRole, string> = {
  patient: 'bg-stone-200 text-stone-800',
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

  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [roleFilter, setRoleFilter] = useState<'all' | AdminUserRole>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
      const requestError = err as { response?: { data?: { detail?: string } } }
      setError(requestError.response?.data?.detail || 'No se pudieron cargar los usuarios')
    } finally {
      setLoading(false)
    }
  }, [roleFilter, search])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

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
    setSuccess(null)
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
      setSuccess(`Usuario creado: ${created.email} (${ROLE_LABELS[created.role]})`)
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { detail?: string } } }
      setError(requestError.response?.data?.detail || 'No se pudo crear el usuario')
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
    setSuccess(null)
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    setError(null)
    setSuccess(null)
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
      setSuccess(`Usuario actualizado: ${updated.email}`)
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { detail?: string } } }
      setError(requestError.response?.data?.detail || 'No se pudo actualizar el usuario')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: AdminUser) => {
    if (!window.confirm(`¿Eliminar definitivamente a ${item.email}?`)) return
    setError(null)
    setSuccess(null)
    try {
      await deleteAdminUser(item.id)
      setUsers((current) => current.filter((entry) => entry.id !== item.id))
      setTotal((current) => Math.max(0, current - 1))
      if (selected?.id === item.id) {
        setSelected(null)
      }
      setSuccess(`Usuario eliminado: ${item.email}`)
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { detail?: string } } }
      setError(requestError.response?.data?.detail || 'No se pudo eliminar el usuario')
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-sky-700">Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-stone-950">Usuarios del sistema</h1>
        <p className="mt-2 max-w-3xl text-stone-600">
          Crea, consulta, edita y elimina cuentas de pacientes, revisores y administradores. Los médicos se
          generan desde el flujo de postulación y aquí puedes gestionar su rol y estado.
        </p>

        <form onSubmit={handleCreate} className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto] lg:items-end">
          <div>
            <label className="text-xs uppercase tracking-[0.22em] text-stone-500">Email</label>
            <input
              type="email"
              value={createEmail}
              onChange={(event) => setCreateEmail(event.target.value)}
              className="input-field mt-2"
              placeholder="usuario@clinica.com"
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.22em] text-stone-500">Contraseña</label>
            <input
              type="password"
              value={createPassword}
              onChange={(event) => setCreatePassword(event.target.value)}
              className="input-field mt-2"
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.22em] text-stone-500">Rol</label>
            <select
              value={createRole}
              onChange={(event) => setCreateRole(event.target.value as AdminUserRole)}
              className="input-field mt-2"
            >
              {ROLE_OPTIONS.filter((role) => role !== 'doctor').map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="btn-primary inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Crear
          </button>
        </form>
        <label className="mt-3 flex items-center gap-3 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={createIsReviewer}
            onChange={(event) => setCreateIsReviewer(event.target.checked)}
            className="h-4 w-4"
          />
          Dar acceso de revisión (revisor)
        </label>
        <p className="mt-2 text-xs text-stone-500">
          Para médicos: la cuenta se crea al completar la postulación; luego puedes cambiar su rol y marcar
          "Acceso de revisión" aquí.
        </p>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{success}</div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="text-xs uppercase tracking-[0.22em] text-stone-500">Buscar</label>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="input-field mt-2"
                  placeholder="Email..."
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.22em] text-stone-500">Rol</label>
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as 'all' | AdminUserRole)}
                  className="input-field mt-2"
                >
                  {FILTER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === 'all' ? 'Todos' : ROLE_LABELS[option]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={loadUsers}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-stone-900 hover:text-stone-950"
            >
              <RefreshCcw className="h-4 w-4" />
              Recargar
            </button>
          </div>

          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-stone-500">{total} usuarios</p>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="flex min-h-[200px] items-center justify-center text-stone-500">
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Cargando usuarios...
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-stone-200 px-6 py-12 text-center text-stone-500">
                No hay usuarios para este filtro.
              </div>
            ) : (
              users.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col gap-3 rounded-3xl border p-4 transition-colors md:flex-row md:items-center md:justify-between ${
                    selected?.id === item.id ? 'border-sky-500 bg-sky-50' : 'border-stone-200 bg-white'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-stone-900">{item.email}</p>
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
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
                      Alta: {new Date(item.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <div className="relative flex-none" data-user-menu>
                    <button
                      onClick={() => setOpenMenuId((current) => (current === item.id ? null : item.id))}
                      className="rounded-full border border-stone-300 p-2 text-stone-600 transition-colors hover:border-stone-900 hover:text-stone-900"
                      aria-label={`Acciones para ${item.email}`}
                      aria-haspopup="true"
                      aria-expanded={openMenuId === item.id}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {openMenuId === item.id && (
                      <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-stone-200 bg-white py-1 shadow-xl">
                        <button
                          onClick={() => {
                            setOpenMenuId(null)
                            handleSelect(item)
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-stone-700 transition-colors hover:bg-stone-50"
                        >
                          <Pencil className="h-4 w-4 text-stone-400" />
                          Editar
                        </button>

                        <div className="my-1 border-t border-stone-100" />

                        <button
                          onClick={() => {
                            setOpenMenuId(null)
                            handleDelete(item)
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
              ))
            )}
          </div>
        </section>

        <section className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-sm">
          {!selected ? (
            <div className="flex min-h-[280px] items-center justify-center text-center text-stone-500">
              Selecciona “Editar” en un usuario para modificar su email, rol o contraseña.
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-sky-700">Editar usuario</p>
                  <p className="mt-1 text-sm text-stone-500">#{selected.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-full border border-stone-200 p-2 text-stone-500 hover:border-stone-400"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.22em] text-stone-500">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                  className="input-field mt-2"
                  required
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.22em] text-stone-500">Rol</label>
                <select
                  value={editRole}
                  onChange={(event) => setEditRole(event.target.value as AdminUserRole)}
                  className="input-field mt-2"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
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

              <div>
                <label className="text-xs uppercase tracking-[0.22em] text-stone-500">Nueva contraseña</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(event) => setEditPassword(event.target.value)}
                  className="input-field mt-2"
                  placeholder="Dejar en blanco para no cambiar"
                  minLength={8}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar cambios
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
