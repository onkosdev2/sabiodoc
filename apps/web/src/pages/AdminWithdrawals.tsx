import { useCallback, useEffect, useState } from 'react'
import { Banknote, CheckCircle2, RefreshCcw, XCircle } from 'lucide-react'

import {
  getAdminWithdrawals,
  processWithdrawal,
  Withdrawal,
  WithdrawalStatus,
} from '../api/wallet'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import { formatMoney } from '../utils/format'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/Pagination'
import Skeleton from '../components/ui/Skeleton'
import { usePagination } from '../hooks/usePagination'

type FilterValue = 'all' | WithdrawalStatus

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'paid', label: 'Pagadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'all', label: 'Todas' },
]

const STATUS_LABELS: Record<WithdrawalStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  rejected: 'Rechazado',
}

const STATUS_TONES: Record<WithdrawalStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  paid: 'success',
  rejected: 'danger',
}

export default function AdminWithdrawals() {
  const toast = useToast()
  const [filter, setFilter] = useState<FilterValue>('pending')
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<number | null>(null)

  const { page, setPage, pageItems, totalPages, totalItems, pageSize } = usePagination(
    withdrawals,
    10,
    filter,
  )

  const load = useCallback(
    async (nextFilter: FilterValue) => {
      setLoading(true)
      try {
        const response = await getAdminWithdrawals(nextFilter === 'all' ? undefined : nextFilter)
        setWithdrawals(response.withdrawals)
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudieron cargar las solicitudes de retiro.'))
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    load(filter)
  }, [filter, load])

  const handleProcess = async (withdrawal: Withdrawal, approve: boolean) => {
    setPendingId(withdrawal.id)
    try {
      const updated = await processWithdrawal(withdrawal.id, approve)
      setWithdrawals((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      toast.success(approve ? 'Retiro marcado como pagado.' : 'Retiro rechazado y créditos devueltos.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo procesar el retiro.'))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Banknote}
        title="Retiros de créditos"
        description="Aprueba o rechaza las solicitudes de conversión de créditos a dinero."
        actions={
          <Button
            variant="secondary"
            onClick={() => load(filter)}
            disabled={loading}
            leftIcon={<RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Recargar
          </Button>
        }
      />

      <div role="tablist" aria-label="Filtrar retiros" className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {FILTERS.map((option) => {
          const selected = filter === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(option.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                selected ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : withdrawals.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="Sin solicitudes de retiro"
          description="Cuando un usuario solicite retirar créditos, aparecerá aquí."
        />
      ) : (
        <div className="space-y-4">
          {pageItems.map((withdrawal) => (
            <article
              key={withdrawal.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-slate-900">{formatMoney(withdrawal.amount_cents)}</p>
                    <Badge tone={STATUS_TONES[withdrawal.status]}>{STATUS_LABELS[withdrawal.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Solicita: <span className="font-medium text-slate-800">{withdrawal.user_email || `Usuario #${withdrawal.user_id}`}</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Destino: {withdrawal.destination}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {withdrawal.requested_at
                      ? new Date(withdrawal.requested_at).toLocaleString('es-ES')
                      : ''}
                  </p>
                  {withdrawal.admin_notes && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {withdrawal.admin_notes}
                    </p>
                  )}
                </div>

                {withdrawal.status === 'pending' && (
                  <div className="flex flex-none gap-2">
                    <Button
                      size="sm"
                      loading={pendingId === withdrawal.id}
                      onClick={() => handleProcess(withdrawal, true)}
                      leftIcon={<CheckCircle2 className="h-4 w-4" />}
                    >
                      Aprobar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-rose-700 hover:bg-rose-50"
                      loading={pendingId === withdrawal.id}
                      onClick={() => handleProcess(withdrawal, false)}
                      leftIcon={<XCircle className="h-4 w-4" />}
                    >
                      Rechazar
                    </Button>
                  </div>
                )}
              </div>
            </article>
          ))}
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}
