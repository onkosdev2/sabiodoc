import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react'

import {
  createAdminSpecialty,
  deleteAdminSpecialty,
  getAdminSpecialties,
  updateAdminSpecialty,
} from '../api/admin'
import type { Specialty } from '../api/specialties'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import { usePagination } from '../hooks/usePagination'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import { Input, Textarea } from '../components/ui/Field'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/Pagination'
import Skeleton from '../components/ui/Skeleton'

interface FormState {
  name: string
  slug: string
  description: string
  keywords: string
  is_top: boolean
}

const EMPTY_FORM: FormState = { name: '', slug: '', description: '', keywords: '', is_top: false }

export default function AdminSpecialties() {
  const toast = useToast()
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Specialty | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [pendingDelete, setPendingDelete] = useState<Specialty | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAdminSpecialties()
      setSpecialties(data.specialties)
      setError(null)
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar las especialidades.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return specialties
    return specialties.filter(
      (item) =>
        item.name.toLowerCase().includes(term) || item.slug.toLowerCase().includes(term),
    )
  }, [specialties, search])

  const { page, setPage, pageItems, totalPages, totalItems, pageSize } = usePagination(filtered, 10)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (specialty: Specialty) => {
    setEditing(specialty)
    setForm({
      name: specialty.name,
      slug: specialty.slug,
      description: specialty.description ?? '',
      keywords: specialty.keywords.join(', '),
      is_top: specialty.is_top,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (form.name.trim().length < 2) {
      toast.error('El nombre debe tener al menos 2 caracteres.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || null,
        description: form.description.trim() || null,
        keywords: form.keywords
          .split(',')
          .map((keyword) => keyword.trim())
          .filter(Boolean),
        is_top: form.is_top,
      }
      if (editing) {
        const updated = await updateAdminSpecialty(editing.id, payload)
        setSpecialties((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
        toast.success('Especialidad actualizada.')
      } else {
        const created = await createAdminSpecialty(payload)
        setSpecialties((current) =>
          [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'es')),
        )
        toast.success('Especialidad creada.')
      }
      setModalOpen(false)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'No se pudo guardar la especialidad.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteAdminSpecialty(pendingDelete.id)
      setSpecialties((current) => current.filter((item) => item.id !== pendingDelete.id))
      toast.success('Especialidad eliminada.')
      setPendingDelete(null)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'No se pudo eliminar la especialidad.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Star}
        title="Especialidades"
        description="Crea, edita o elimina las especialidades que ofrecen los médicos."
        actions={
          <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
            Nueva especialidad
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o slug..."
          aria-label="Buscar especialidades"
          className="input-field pl-10"
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Sin especialidades"
          description={search ? 'No hay resultados para tu búsqueda.' : 'Crea la primera especialidad.'}
          action={
            <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
              Nueva especialidad
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="hidden px-4 py-3 md:table-cell">Slug</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Médicos</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((specialty) => (
                  <tr key={specialty.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{specialty.name}</span>
                        {specialty.is_top && <Badge tone="warning">Destacada</Badge>}
                      </div>
                      {specialty.description && (
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                          {specialty.description}
                        </p>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-500 md:table-cell">{specialty.slug}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <Link
                        to={`/specialties/${specialty.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700"
                      >
                        Ver <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(specialty)}
                          aria-label={`Editar ${specialty.name}`}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingDelete(specialty)}
                          aria-label={`Eliminar ${specialty.name}`}
                          title="Eliminar"
                          className="text-slate-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Editar especialidad' : 'Nueva especialidad'}
        description="Nombre, slug y palabras clave ayudan a la búsqueda y a la IA."
        className="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Ej: Cardiología"
            required
            autoFocus
          />
          <Input
            label="Slug"
            value={form.slug}
            onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            placeholder="cardio (opcional, se genera del nombre)"
            hint="Solo minúsculas, números y guiones."
          />
          <Textarea
            label="Descripción"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            className="min-h-20"
          />
          <Input
            label="Palabras clave"
            value={form.keywords}
            onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))}
            placeholder="corazón, cardiovascular, presión"
            hint="Sepáralas con comas."
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              checked={form.is_top}
              onChange={(event) =>
                setForm((current) => ({ ...current, is_top: event.target.checked }))
              }
            />
            Marcar como destacada
          </label>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear especialidad'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title="¿Eliminar especialidad?"
        description={
          pendingDelete
            ? `Se eliminará "${pendingDelete.name}". No se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setPendingDelete(null)
        }}
      />
    </div>
  )
}
