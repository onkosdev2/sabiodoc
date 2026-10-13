import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Coins,
  Landmark,
  PiggyBank,
  Receipt,
  RefreshCcw,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import {
  CommissionItem,
  FinanceMovement,
  FinanceOverview,
  getFinanceOverview,
  getFinanceMovements,
  getPlatformCommissions,
} from '../api/finance'
import { getAdminWithdrawals, Withdrawal, WithdrawalStatus } from '../api/wallet'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import { formatMoney } from '../utils/format'
import { ROLE_LABELS } from '../utils/roles'
import { WALLET_TRANSACTION_STATUS_LABELS } from '../utils/statusLabels'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import type { BadgeTone } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'

const PAGE_SIZE = 50

type RangeValue = '7d' | '30d' | '90d' | 'all'
type TabValue = 'commissions' | 'movements' | 'withdrawals'
type WithdrawalFilter = 'all' | WithdrawalStatus

const RANGE_LABELS: Record<RangeValue, string> = {
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  all: 'Todo el histórico',
}

const MOVEMENT_LABELS: Record<string, string> = {
  topup: 'Recarga',
  withdrawal: 'Retiro',
  consultation_payment: 'Pago de consulta',
  consultation_income: 'Pago al médico',
  refund: 'Reembolso',
  adjustment: 'Ajuste',
}

const MOVEMENT_TONES: Record<string, BadgeTone> = {
  topup: 'success',
  withdrawal: 'warning',
  consultation_payment: 'info',
  consultation_income: 'primary',
  refund: 'danger',
  adjustment: 'neutral',
}

const WITHDRAWAL_LABELS: Record<WithdrawalStatus, string> = {
  pending: 'Pendiente',
  processing: 'En proceso',
  paid: 'Pagado',
  failed: 'Fallido',
  rejected: 'Rechazado',
}

const WITHDRAWAL_TONES: Record<WithdrawalStatus, BadgeTone> = {
  pending: 'warning',
  processing: 'warning',
  paid: 'success',
  failed: 'danger',
  rejected: 'danger',
}

const WITHDRAWAL_FILTERS: { value: WithdrawalFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'processing', label: 'En proceso' },
  { value: 'paid', label: 'Pagados' },
  { value: 'failed', label: 'Fallidos' },
]

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '-'

const rangeStart = (value: RangeValue): string | undefined => {
  if (value === 'all') return undefined
  const days = value === '7d' ? 7 : value === '30d' ? 30 : 90
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export default function AdminFinance() {
  const toast = useToast()
  const [range, setRange] = useState<RangeValue>('30d')
  const [tab, setTab] = useState<TabValue>('commissions')
  const [overview, setOverview] = useState<FinanceOverview | null>(null)
  const [commissions, setCommissions] = useState<CommissionItem[]>([])
  const [commissionTotals, setCommissionTotals] = useState({ gross: 0, fee: 0, net: 0, total: 0 })
  const [movements, setMovements] = useState<FinanceMovement[]>([])
  const [movementTotals, setMovementTotals] = useState({ total: 0, inflow: 0, outflow: 0 })
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [withdrawalStatus, setWithdrawalStatus] = useState<WithdrawalFilter>('all')
  const [withdrawalTotal, setWithdrawalTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  const start = useMemo(() => rangeStart(range), [range])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const overviewData = await getFinanceOverview({ start })
      setOverview(overviewData)

      if (tab === 'commissions') {
        const data = await getPlatformCommissions({ start, limit: PAGE_SIZE, offset })
        setCommissions(data.items)
        setCommissionTotals({
          gross: data.gross_cents,
          fee: data.fee_cents,
          net: data.net_cents,
          total: data.total,
        })
      } else if (tab === 'movements') {
        const data = await getFinanceMovements({ start, limit: PAGE_SIZE, offset })
        setMovements(data.items)
        setMovementTotals({
          total: data.total,
          inflow: data.inflow_cents,
          outflow: data.outflow_cents,
        })
      } else {
        // Los retiros se filtran por rango y estado en el backend.
        const data = await getAdminWithdrawals({
          status_filter: withdrawalStatus === 'all' ? undefined : withdrawalStatus,
          start,
        })
        setWithdrawalTotal(data.withdrawals.length)
        setWithdrawals(data.withdrawals.slice(offset, offset + PAGE_SIZE))
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar la información financiera'))
    } finally {
      setLoading(false)
    }
  }, [start, tab, offset, withdrawalStatus, toast])

  useEffect(() => {
    load()
  }, [load])

  // Al cambiar de rango o pestaña, volvemos a la primera página.
  useEffect(() => {
    setOffset(0)
  }, [range, tab, withdrawalStatus])

  const total =
    tab === 'commissions'
      ? commissionTotals.total
      : tab === 'movements'
        ? movementTotals.total
        : withdrawalTotal

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Landmark}
        title="Ingresos y salidas"
        description={`Todo el dinero que se mueve en SabioDoc y las ganancias por comisión de la plataforma (${overview?.platform_fee_percent ?? 20}%).`}
        actions={
          <Button
            variant="secondary"
            onClick={load}
            disabled={loading}
            leftIcon={<RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            {loading ? 'Cargando...' : 'Actualizar'}
          </Button>
        }
      />

      {overview?.is_mock_money && (
        <Alert tone="info" title="Dinero de prueba">
          Mientras no se integre la pasarela de pagos real, los importes corresponden a créditos de
          prueba (1 crédito = 1 USD). Las cifras ya reflejan la comisión y el flujo real del sistema.
        </Alert>
      )}

      {/* Rango de fechas */}
      <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1">
        {(Object.keys(RANGE_LABELS) as RangeValue[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRange(value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              range === value ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {RANGE_LABELS[value]}
          </button>
        ))}
      </div>

      {loading && !overview ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : overview ? (
        <>
          {/* KPIs principales */}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={TrendingUp}
              label="Volumen facturado (GMV)"
              value={formatMoney(overview.gmv_cents)}
              hint={`${overview.completed_count} consultas liquidadas`}
              tone="bg-sky-50 text-sky-700"
            />
            <KpiCard
              icon={Coins}
              label="Comisión de la plataforma"
              value={formatMoney(overview.platform_revenue_cents)}
              hint={`${overview.platform_fee_percent}% sobre lo cobrado`}
              tone="bg-emerald-50 text-emerald-700"
              highlight
            />
            <KpiCard
              icon={Wallet}
              label="Pagado a médicos"
              value={formatMoney(overview.doctor_payouts_cents)}
              hint="Monto neto tras comisión"
              tone="bg-primary-50 text-primary-700"
            />
            <KpiCard
              icon={Receipt}
              label="Reembolsos"
              value={formatMoney(overview.refunds_cents)}
              hint="Devuelto a pacientes"
              tone="bg-rose-50 text-rose-700"
            />
            <KpiCard
              icon={ArrowDownLeft}
              label="Recargas"
              value={formatMoney(overview.topups_cents)}
              hint="Créditos cargados"
              tone="bg-emerald-50 text-emerald-700"
            />
            <KpiCard
              icon={Banknote}
              label="Retiros pagados"
              value={formatMoney(overview.withdrawals_paid_cents)}
              hint={`En proceso: ${formatMoney(overview.withdrawals_processing_cents)} · Fallidos: ${formatMoney(overview.withdrawals_failed_cents)}`}
              tone="bg-amber-50 text-amber-700"
            />
            <KpiCard
              icon={PiggyBank}
              label="En custodia (retenido)"
              value={formatMoney(overview.held_cents)}
              hint="Citas no liquidadas aún"
              tone="bg-slate-100 text-slate-700"
            />
            <KpiCard
              icon={Landmark}
              label="Saldos de usuarios"
              value={formatMoney(overview.user_balances_cents)}
              hint={`De médicos: ${formatMoney(overview.doctor_balances_cents)}`}
              tone="bg-slate-100 text-slate-700"
            />
          </section>

          {/* Pestañas */}
          <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1">
            {(
              [
                { value: 'commissions', label: 'Ganancias por comisión' },
                { value: 'movements', label: 'Todos los movimientos' },
                { value: 'withdrawals', label: 'Retiros' },
              ] as { value: TabValue; label: string }[]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTab(option.value)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  tab === option.value ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {tab === 'commissions' ? (
            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <p className="text-sm text-slate-600">
                  Bruto <span className="font-semibold text-slate-900">{formatMoney(commissionTotals.gross)}</span> ·
                  Comisión <span className="font-semibold text-emerald-700">{formatMoney(commissionTotals.fee)}</span> ·
                  Neto médicos <span className="font-semibold text-slate-900">{formatMoney(commissionTotals.net)}</span>
                </p>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{commissionTotals.total} citas</span>
              </div>
              {loading ? (
                <Skeleton className="m-4 h-40 rounded-xl" />
              ) : commissions.length === 0 ? (
                <div className="p-4">
                  <EmptyState icon={Coins} title="Sin comisiones" description="No hay citas liquidadas en este periodo." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Médico</th>
                        <th className="px-4 py-3">Paciente</th>
                        <th className="px-4 py-3 text-right">Bruto</th>
                        <th className="px-4 py-3 text-right">Comisión {overview.platform_fee_percent}%</th>
                        <th className="px-4 py-3 text-right">Neto médico</th>
                        <th className="px-4 py-3 text-right">Cita</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {commissions.map((item) => (
                        <tr key={item.appointment_payment_id} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                            {formatDateTime(item.released_at)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{item.doctor_name}</p>
                            <p className="text-xs text-slate-500">{item.doctor_email}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">{item.patient_email}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                            {formatMoney(item.gross_cents)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">
                            +{formatMoney(item.fee_cents)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                            {formatMoney(item.net_cents)}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500">#{item.appointment_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : tab === 'movements' ? (
            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-sm">
                <p className="text-slate-600">
                  Entradas{' '}
                  <span className="font-semibold text-emerald-700">{formatMoney(movementTotals.inflow)}</span> · Salidas{' '}
                  <span className="font-semibold text-rose-700">{formatMoney(movementTotals.outflow)}</span>
                </p>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{movementTotals.total} movimientos</span>
              </div>
              {loading ? (
                <Skeleton className="m-4 h-40 rounded-xl" />
              ) : movements.length === 0 ? (
                <div className="p-4">
                  <EmptyState icon={ArrowUpRight} title="Sin movimientos" description="No hay movimientos en este periodo." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Usuario</th>
                        <th className="px-4 py-3">Detalle</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {movements.map((movement) => {
                        const isIn = movement.direction === 'in'
                        return (
                          <tr key={movement.id} className="hover:bg-slate-50">
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                              {formatDateTime(movement.created_at)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge tone={MOVEMENT_TONES[movement.type] ?? 'neutral'}>
                                {MOVEMENT_LABELS[movement.type] ?? movement.type}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              <p>{movement.actor_email ?? '—'}</p>
                              {movement.actor_role && (
                                <p className="text-slate-400">
                                  {ROLE_LABELS[movement.actor_role as keyof typeof ROLE_LABELS] ??
                                    movement.actor_role}
                                </p>
                              )}
                            </td>
                            <td className="max-w-[260px] px-4 py-3 text-xs text-slate-500">
                              <span className="line-clamp-2">{movement.description}</span>
                              {movement.reference_type && (
                                <span className="text-slate-400">
                                  {movement.reference_type} #{movement.reference_id}
                                </span>
                              )}
                            </td>
                            <td
                              className={`px-4 py-3 text-right tabular-nums font-semibold ${
                                isIn ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {isIn ? '+' : '−'}
                              {formatMoney(movement.amount_cents)}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              {WALLET_TRANSACTION_STATUS_LABELS[movement.status] ?? movement.status}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  {WITHDRAWAL_FILTERS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setWithdrawalStatus(option.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        withdrawalStatus === option.value
                          ? 'border-primary-300 bg-primary-50 text-primary-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{withdrawalTotal} retiros</span>
              </div>
              {loading ? (
                <Skeleton className="m-4 h-40 rounded-xl" />
              ) : withdrawals.length === 0 ? (
                <div className="p-4">
                  <EmptyState icon={Banknote} title="Sin retiros" description="No hay retiros en este periodo." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Usuario</th>
                        <th className="px-4 py-3">Destino</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Proveedor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {withdrawals.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                            {formatDateTime(item.processed_at || item.requested_at || item.created_at)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {item.user_email || `Usuario #${item.user_id}`}
                          </td>
                          <td className="max-w-[220px] px-4 py-3 text-xs text-slate-500">
                            <span className="line-clamp-2">{item.destination}</span>
                            {item.failure_reason && (
                              <span className="mt-0.5 block text-rose-600">{item.failure_reason}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                            {formatMoney(item.amount_cents)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={WITHDRAWAL_TONES[item.status]}>{WITHDRAWAL_LABELS[item.status]}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {item.provider || '—'}
                            {item.provider_reference && (
                              <span className="block text-slate-400">{item.provider_reference}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <span>
              Mostrando {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                Anterior
              </Button>
              <Button size="sm" variant="ghost" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => setOffset(offset + PAGE_SIZE)}>
                Siguiente
              </Button>
            </div>
          </div>
        </>
      ) : (
        <Alert tone="danger" title="No se pudo cargar la información financiera">
          Vuelve a intentarlo en unos segundos.
        </Alert>
      )}
    </div>
  )
}

interface KpiCardProps {
  icon: typeof TrendingUp
  label: string
  value: string
  hint?: string
  tone: string
  highlight?: boolean
}

function KpiCard({ icon: Icon, label, value, hint, tone, highlight }: KpiCardProps) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        highlight ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`rounded-xl p-2 ${tone}`} aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
