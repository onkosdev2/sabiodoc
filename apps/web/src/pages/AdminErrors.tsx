import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Copy,
  Eye,
  Filter,
  Globe,
  MonitorSmartphone,
  RefreshCcw,
  Server,
  Trash2,
} from 'lucide-react'

import {
  ErrorLogDetail,
  ErrorLogItem,
  ErrorLogSummary,
  cleanupErrorLogs,
  deleteErrorLog,
  deleteErrorLogs,
  getErrorLog,
  getErrorLogs,
} from '../api/errors'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import { ERROR_LEVEL_LABELS } from '../utils/statusLabels'
import Badge from '../components/ui/Badge'
import type { BadgeTone } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import { Input, Select } from '../components/ui/Field'

const PAGE_SIZE = 50

const LEVEL_TONES: Record<string, BadgeTone> = {
  error: 'danger',
  warning: 'warning',
  info: 'info',
}

const LEVEL_LABELS: Record<string, string> = ERROR_LEVEL_LABELS

const SOURCE_LABELS: Record<string, string> = {
  backend: 'Servidor',
  client: 'Navegador',
}

const formatDateTime = (value: string | null) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const shortPath = (item: ErrorLogItem) => {
  if (!item.path) return item.error_type || '-'
  return `${item.method ? `${item.method} ` : ''}${item.path}`
}

const buildDetailText = (detail: ErrorLogDetail) => {
  const lines = [
    `Error #${detail.id} · ${LEVEL_LABELS[detail.level] ?? detail.level} · ${formatDateTime(detail.created_at)}`,
    `Origen: ${SOURCE_LABELS[detail.source] ?? detail.source}${detail.status_code ? ` · HTTP ${detail.status_code}` : ''}`,
    `Tipo: ${detail.error_type || '-'}`,
    `Mensaje: ${detail.message}`,
    `Ruta: ${detail.method ? `${detail.method} ` : ''}${detail.path || '-'}`,
    `Usuario: ${detail.user_email || '-'}${detail.user_role ? ` (${detail.user_role})` : ''}`,
    detail.video_session_id ? `Videoconsulta: #${detail.video_session_id}` : null,
    detail.appointment_id ? `Cita: #${detail.appointment_id}` : null,
    detail.request_id ? `Request ID: ${detail.request_id}` : null,
    detail.user_agent ? `User-Agent: ${detail.user_agent}` : null,
    detail.ip_address ? `IP: ${detail.ip_address}` : null,
    detail.context ? `\nContexto:\n${JSON.stringify(detail.context, null, 2)}` : null,
    detail.stack_trace ? `\nStack trace:\n${detail.stack_trace}` : null,
  ].filter(Boolean)
  return lines.join('\n')
}

interface PendingDelete {
  ids: number[]
  label: string
}

export default function AdminErrors() {
  const toast = useToast()
  const [items, setItems] = useState<ErrorLogItem[]>([])
  const [summary, setSummary] = useState<ErrorLogSummary | null>(null)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [level, setLevel] = useState('')
  const [videoOnly, setVideoOnly] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [detail, setDetail] = useState<ErrorLogDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  // Retrasa la búsqueda para no lanzar una petición por cada tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setOffset(0)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true)
      else setLoading(true)
      try {
        const data = await getErrorLogs({
          source: source || undefined,
          level: level || undefined,
          video_only: videoOnly || undefined,
          search: search || undefined,
          limit: PAGE_SIZE,
          offset,
        })
        setItems(data.items)
        setSummary(data.summary)
        setTotal(data.total)
        setSelectedIds(new Set())
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudieron cargar los errores'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [source, level, videoOnly, search, offset, toast],
  )

  useEffect(() => {
    load('initial')
  }, [load])

  const openDetail = async (item: ErrorLogItem) => {
    setDetailLoading(true)
    try {
      const data = await getErrorLog(item.id)
      setDetail(data)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar el detalle del error'))
    } finally {
      setDetailLoading(false)
    }
  }

  const toggleOne = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id))

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((item) => item.id)))
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Detalle copiado al portapapeles.')
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto manualmente.')
    }
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const { ids } = pendingDelete
      if (ids.length === 1) {
        await deleteErrorLog(ids[0])
        toast.success('Error eliminado.')
        if (detail?.id === ids[0]) setDetail(null)
      } else {
        const result = await deleteErrorLogs(ids)
        toast.success(`Se eliminaron ${result.deleted} errores.`)
        if (detail && ids.includes(detail.id)) setDetail(null)
      }
      setPendingDelete(null)
      await load('refresh')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron eliminar los errores'))
    } finally {
      setDeleting(false)
    }
  }

  const handleCleanup = async () => {
    if (!window.confirm('¿Purgar los errores más antiguos que el periodo de retención (60 días)?')) {
      return
    }
    setCleaning(true)
    try {
      const result = await cleanupErrorLogs()
      toast.success(`Se eliminaron ${result.deleted} registros antiguos.`)
      await load('refresh')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo purgar el registro'))
    } finally {
      setCleaning(false)
    }
  }

  const stats = useMemo(
    () => [
      { label: 'Total registrado', value: summary?.total ?? 0, tone: 'text-slate-900' },
      { label: 'Últimas 24 h', value: summary?.last_24h ?? 0, tone: 'text-amber-600' },
      { label: 'Videollamadas', value: summary?.video_total ?? 0, tone: 'text-sky-600' },
      { label: 'Del navegador', value: summary?.client_total ?? 0, tone: 'text-violet-600' },
    ],
    [summary],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Bug}
        title="Errores del sistema"
        description="Errores del servidor y del navegador con su causa, usuario y stack trace. Registro sanitizado (sin contraseñas ni tokens) y retención de 60 días."
        actions={
          <>
            <Button
              variant="ghost"
              onClick={handleCleanup}
              loading={cleaning}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Purgar antiguos
            </Button>
            <Button
              variant="secondary"
              onClick={() => load('refresh')}
              disabled={refreshing}
              leftIcon={<RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
            >
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
            <p className={`mt-1 text-3xl font-bold ${stat.tone}`}>{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              label="Buscar"
              placeholder="Mensaje, ruta, correo, request ID…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <Select
            label="Origen"
            value={source}
            onChange={(event) => {
              setSource(event.target.value)
              setOffset(0)
            }}
          >
            <option value="">Todos</option>
            <option value="backend">Servidor</option>
            <option value="client">Navegador</option>
          </Select>
          <Select
            label="Nivel"
            value={level}
            onChange={(event) => {
              setLevel(event.target.value)
              setOffset(0)
            }}
          >
            <option value="">Todos</option>
            <option value="error">Error</option>
            <option value="warning">Advertencia</option>
            <option value="info">Info</option>
          </Select>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={videoOnly}
              onChange={(event) => {
                setVideoOnly(event.target.checked)
                setOffset(0)
              }}
            />
            Solo videollamadas
          </label>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Sin errores para este filtro"
          description="Buenas noticias: no hay errores registrados con los criterios seleccionados."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              <span>{selectedIds.size} seleccionado(s)</span>
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  setPendingDelete({
                    ids: [...selectedIds],
                    label: `${selectedIds.size} errores`,
                  })
                }
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Eliminar seleccionados
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-6 w-6 rounded border-slate-300"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Seleccionar todos los errores de esta página"
                    />
                  </th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Nivel</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3">Módulo / ruta</th>
                  <th className="px-4 py-3">Mensaje</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Sesión</th>
                  <th className="px-4 py-3">Reps.</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-6 w-6 rounded border-slate-300"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleOne(item.id)}
                        aria-label={`Seleccionar error #${item.id}`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                      {formatDateTime(item.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={LEVEL_TONES[item.level] ?? 'neutral'}>
                        {LEVEL_LABELS[item.level] ?? item.level}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={item.source === 'client' ? 'info' : 'primary'}>
                        {item.source === 'client' ? (
                          <MonitorSmartphone className="h-3 w-3" />
                        ) : (
                          <Server className="h-3 w-3" />
                        )}
                        {SOURCE_LABELS[item.source] ?? item.source}
                      </Badge>
                    </td>
                    <td className="max-w-[240px] px-4 py-3">
                      <p className="truncate font-mono text-xs text-slate-700">{shortPath(item)}</p>
                      {item.status_code != null && (
                        <span className="text-xs text-slate-600">HTTP {item.status_code}</span>
                      )}
                    </td>
                    <td className="max-w-[320px] px-4 py-3">
                      <p className="line-clamp-2 text-slate-800">{item.message}</p>
                      {item.error_type && (
                        <p className="mt-0.5 font-mono text-xs text-slate-600">{item.error_type}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {item.user_email ? (
                        <>
                          <p className="max-w-[180px] truncate">{item.user_email}</p>
                          {item.user_role && <p className="text-slate-600">{item.user_role}</p>}
                        </>
                      ) : (
                        <span className="text-slate-600">Anónimo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {item.video_session_id ? (
                        <span className="font-mono">#{item.video_session_id}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {item.occurrences > 1 ? `×${item.occurrences}` : '1'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openDetail(item)}
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Ver detalle del error #${item.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({ ids: [item.id], label: `el error #${item.id}` })
                          }
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label={`Eliminar error #${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span>
              Mostrando {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      )}

      <p className="text-xs text-slate-600">
        <Filter className="mr-1 inline h-3 w-3" aria-hidden="true" />
        Consejo: para investigar una videollamada, filtra «Solo videollamadas» y comparte el{' '}
        <strong>request ID</strong> o el <strong>ID de sesión</strong> con el equipo técnico. Haz clic
        en una fila para ver el detalle.
      </p>

      <Modal
        open={detail !== null || detailLoading}
        onClose={() => {
          if (!deleting) setDetail(null)
        }}
        title={detail ? `Error #${detail.id}` : 'Cargando error…'}
        description={detail ? formatDateTime(detail.created_at) : undefined}
        className="max-w-3xl"
      >
        {detailLoading || !detail ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={LEVEL_TONES[detail.level] ?? 'neutral'}>
                {LEVEL_LABELS[detail.level] ?? detail.level}
              </Badge>
              <Badge tone={detail.source === 'client' ? 'info' : 'primary'}>
                {detail.source === 'client' ? (
                  <Globe className="h-3 w-3" />
                ) : (
                  <Server className="h-3 w-3" />
                )}
                {SOURCE_LABELS[detail.source] ?? detail.source}
              </Badge>
              {detail.status_code != null && <Badge tone="neutral">HTTP {detail.status_code}</Badge>}
              {detail.occurrences > 1 && <Badge tone="neutral">{detail.occurrences} repeticiones</Badge>}
            </div>

            <div className="rounded-xl border border-red-100 bg-red-50 p-3">
              <p className="flex items-start gap-2 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="break-words font-medium">{detail.message}</span>
              </p>
            </div>

            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-slate-500">Tipo</dt>
                <dd className="font-mono text-xs text-slate-800">{detail.error_type || '-'}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-slate-500">Ruta</dt>
                <dd className="break-all font-mono text-xs text-slate-800">
                  {detail.method ? `${detail.method} ` : ''}
                  {detail.path || '-'}
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-slate-500">Usuario</dt>
                <dd className="text-slate-800">
                  {detail.user_email || 'Anónimo'}
                  {detail.user_role ? ` (${detail.user_role})` : ''}
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-slate-500">Request ID</dt>
                <dd className="break-all font-mono text-xs text-slate-800">
                  {detail.request_id || '-'}
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-slate-500">Videoconsulta / cita</dt>
                <dd className="text-slate-800">
                  {detail.video_session_id ? `Sesión #${detail.video_session_id}` : '-'}
                  {detail.appointment_id ? ` · Cita #${detail.appointment_id}` : ''}
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-slate-500">IP</dt>
                <dd className="font-mono text-xs text-slate-800">{detail.ip_address || '-'}</dd>
              </div>
            </dl>

            {detail.context && (
              <details className="rounded-xl border border-slate-200">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">
                  Contexto (JSON)
                </summary>
                <pre className="max-h-56 overflow-auto bg-slate-950 p-3 text-xs text-slate-100">
                  {JSON.stringify(detail.context, null, 2)}
                </pre>
              </details>
            )}

            {detail.stack_trace && (
              <details className="rounded-xl border border-slate-200" open>
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">
                  Stack trace
                </summary>
                <pre className="max-h-64 overflow-auto bg-slate-950 p-3 text-xs text-slate-100">
                  {detail.stack_trace}
                </pre>
              </details>
            )}

            {detail.user_agent && (
              <p className="break-words text-xs text-slate-500">User-Agent: {detail.user_agent}</p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => handleCopy(buildDetailText(detail))}
                leftIcon={<Copy className="h-4 w-4" />}
              >
                Copiar detalle
              </Button>
              <Button
                variant="danger"
                onClick={() => setPendingDelete({ ids: [detail.id], label: `el error #${detail.id}` })}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Eliminar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title="¿Eliminar errores?"
        description={
          pendingDelete
            ? `Se eliminará ${pendingDelete.label} de forma permanente. Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
