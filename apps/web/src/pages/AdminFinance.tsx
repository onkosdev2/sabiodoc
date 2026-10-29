import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Coins,
  Landmark,
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
import { getAdminPayouts, PayoutItem, retryAdminPayout } from '../api/earnings'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import { formatMoney } from '../utils/format'
import { ROLE_LABELS } from '../utils/roles'
import { PAYMENT_TRANSACTION_STATUS_LABELS } from '../utils/statusLabels'
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
type TabValue = 'commissions' | 'movements' | 'payouts'

const RANGE_LABELS: Record<RangeValue, string> = {
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  all: 'Todo el histórico',
}

const MOVEMENT_LABELS: Record<string, string> = {
  initial: 'Cobro inicial',
  extension: 'Ampliación',
  refund: 'Reembolso',
  payout: 'Payout',
}

const MOVEMENT_TONES: Record<string, BadgeTone> = {
  initial: 'success',
  extension: 'info',
  refund: 'danger',
  payout: 'warning',
}

const PAYOUT_LABELS: Record<PayoutItem['status'], string> = {
  pending: 'Pendiente',
  processing: 'En proceso',
  paid: 'Pagado',
  failed: 'Fallido',
}

const PAYOUT_TONES: Record<PayoutItem['status'], BadgeTone> = {
  pending: 'warning',
  processing: 'warning',
  paid: 'success',
  failed: 'danger',
}

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
  const [payouts, setPayouts] = useState<PayoutItem[]>([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [retryingId, setRetryingId] = useState<number | null>(null)

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
        const data = await getAdminPayouts()
        setPayouts(data)
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar la información financiera'))
    } finally {
      setLoading(false)
    }
  }, [start, tab, offset, toast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setOffset(0)
  }, [range, tab])

  const handleRetry = async (payout: PayoutItem) => {
    setRetryingId(payout.id)
    try {
      await retryAdminPayout(payout.id)
      toast.success('Payout reintentado.')
      await load()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo reintentar el payout.'))
    } finally {
      setRetryingId(null)
    }
  }

  const total =
    tab === 'commissions'
      ? commissionTotals.total
      : tab === 'movements'
        ? movementTotals.total
        : payouts.length

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Landmark}
        title="Ingresos y salidas"
        description={`Cobros de videoconsultas, comisión de la plataforma e ingresos de médicos (${overview?.platform_fee_percent ?? 20}%).`}
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
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : overview ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={TrendingUp}
              label="Volumen cobrado"
              value={formatMoney(overview.gmv_cents)}
              hint={`${overview.paid_consultations} consultas cobradas`}
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
              label="Neto para médicos"
              value={formatMoney(overview.doctor_net_cents)}
              hint="Monto después de comisión"
              tone="bg-primary-50 text-primary-700"
            />
            <KpiCard
              icon={Banknote}
              label="Payouts pagados"
              value={formatMoney(overview.payouts_paid_cents)}
              hint={`En proceso: ${formatMoney(overview.payouts_processing_cents)} · Fallidos: ${formatMoney(overview.payouts_failed_cents)}`}
              tone="bg-amber-50 text-amber-700"
            />
            <KpiCard
              icon={ArrowDownLeft}
              label="Pendiente de cobro"
              value={formatMoney(overview.pending_charges_cents)}
              hint="Citas confirmadas aún no cobradas"
              tone="bg-slate-100 text-slate-700"
            />
            <KpiCard
              icon={ArrowUpRight}
              label="Ingresos por retirar"
              value={formatMoney(overview.pending_earnings_cents)}
              hint="Saldo de médicos pendiente de payout"
              tone="bg-slate-100 text-slate-700"
            />
          </section>

          <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1">
            {(
              [
                { value: 'commissions', label: 'Ganancias por comisión' },
                { value: 'movements', label: 'Transacciones' },
                { value: 'payouts', label: 'Payouts' },
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
                  <EmptyState icon={Coins} title="Sin comisiones" description="No hay cobros en este periodo." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Médico</th>
                        <th className="px-4 py-3">Paciente</th>
                        <th className="px-4 py-3 text-right">Minutos</th>
                        <th className="px-4 py-3 text-right">Bruto</th>
                        <th className="px-4 py-3 text-right">Comisión</th>
                        <th className="px-4 py-3 text-right">Neto médico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {commissions.map((item) => (
                        <tr key={item.charge_id} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                            {formatDateTime(item.released_at)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{item.doctor_name}</p>
                            <p className="text-xs text-slate-500">{item.doctor_email}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">{item.patient_email}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">{item.paid_minutes}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                            {formatMoney(item.gross_cents)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">
                            +{formatMoney(item.fee_cents)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                            {formatMoney(item.net_cents)}
                          </td>
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
                  <EmptyState icon={ArrowUpRight} title="Sin movimientos" description="No hay transacciones en este periodo." />
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
                              {movement.provider && (
                                <span className="block text-slate-400">{movement.provider}</span>
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
                              {PAYMENT_TRANSACTION_STATUS_LABELS[movement.status] ?? movement.status}
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
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm">
                <p className="text-slate-600">Payouts solicitados por médicos</p>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{payouts.length} payouts</span>
              </div>
              {loading ? (
                <Skeleton className="m-4 h-40 rounded-xl" />
              ) : payouts.length === 0 ? (
                <div className="p-4">
                  <EmptyState icon={Banknote} title="Sin payouts" description="No hay retiros solicitados." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Proveedor</th>
                        <th className="px-4 py-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payouts.map((payout) => (
                        <tr key={payout.id} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                            {formatDateTime(payout.requested_at)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                            {formatMoney(payout.amount_cents)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={PAYOUT_TONES[payout.status]}>{PAYOUT_LABELS[payout.status]}</Badge>
                            {payout.failure_reason && (
                              <p className="mt-1 text-xs text-rose-600">{payout.failure_reason}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {payout.provider}
                            {payout.provider_reference && (
                              <span className="block text-slate-400">{payout.provider_reference}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {payout.status === 'failed' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={retryingId === payout.id}
                                onClick={() => void handleRetry(payout)}
                              >
                                Reintentar
                              </Button>
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

          {tab !== 'payouts' && (
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
          )}
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
        <p className="text-sm text-slate-600">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
