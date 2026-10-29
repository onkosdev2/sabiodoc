import { useEffect, useState } from 'react'
import { ArrowDownToLine, BadgeDollarSign, Wallet } from 'lucide-react'

import {
  getMyEarnings,
  listMyEarnings,
  listMyPayouts,
  requestPayout,
  type EarningItem,
  type EarningsSummary,
  type PayoutItem,
} from '../api/earnings'
import { getApiErrorMessage } from '../utils/apiError'
import { formatDate, formatMoney } from '../utils/format'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import { useToast } from '../context/ToastContext'

const EARNING_STATUS_LABELS: Record<EarningItem['status'], string> = {
  pending: 'Pendiente',
  available: 'Disponible',
  paid: 'Pagado',
  reversed: 'Revertido',
}

const PAYOUT_STATUS_LABELS: Record<PayoutItem['status'], string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  paid: 'Pagado',
  failed: 'Fallido',
}

export default function DoctorEarnings() {
  const toast = useToast()
  const [summary, setSummary] = useState<EarningsSummary | null>(null)
  const [earnings, setEarnings] = useState<EarningItem[]>([])
  const [payouts, setPayouts] = useState<PayoutItem[]>([])
  const [loading, setLoading] = useState(true)
  const [payoutBusy, setPayoutBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryData, earningsData, payoutsData] = await Promise.all([
        getMyEarnings(),
        listMyEarnings(),
        listMyPayouts(),
      ])
      setSummary(summaryData)
      setEarnings(earningsData)
      setPayouts(payoutsData)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar tus ingresos.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handlePayout = async () => {
    setPayoutBusy(true)
    setError(null)
    try {
      await requestPayout()
      toast.success('Payout solicitado correctamente.')
      await load()
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No se pudo solicitar el payout.'))
    } finally {
      setPayoutBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BadgeDollarSign}
        title="Ingresos y payouts"
        description="Consulta lo que has ganado y solicita el retiro de tus ingresos disponibles."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pendiente</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatMoney(summary?.pending_cents ?? 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Se libera al cerrar la consulta.</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Disponible</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700">
                {formatMoney(summary?.available_cents ?? 0)}
              </p>
              <Button
                className="mt-3"
                size="sm"
                onClick={() => void handlePayout()}
                loading={payoutBusy}
                disabled={(summary?.available_cents ?? 0) <= 0}
                leftIcon={<ArrowDownToLine className="h-4 w-4" />}
              >
                Solicitar payout
              </Button>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pagado</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatMoney(summary?.paid_cents ?? 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Payouts ya procesados.</p>
            </Card>
          </div>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Detalle de ingresos</h2>
            {earnings.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Aún no tienes ingresos"
                description="Cuando completes una videoconsulta, el ingreso aparecerá aquí."
              />
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {earnings.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">Cita #{item.appointment_id}</p>
                      <p className="text-xs text-slate-500">{formatDate(item.created_at)}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-slate-900">{formatMoney(item.net_cents)}</p>
                      <p className="text-xs text-slate-500">
                        Bruto {formatMoney(item.gross_cents)} · comisión {formatMoney(item.platform_fee_cents)}
                      </p>
                    </div>
                    <Badge tone={item.status === 'available' ? 'success' : item.status === 'paid' ? 'info' : 'warning'}>
                      {EARNING_STATUS_LABELS[item.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Payouts</h2>
            {payouts.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Todavía no solicitaste ningún payout.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {payouts.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{formatMoney(item.amount_cents)}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(item.requested_at)}
                        {item.provider_reference ? ` · ${item.provider_reference}` : ''}
                      </p>
                    </div>
                    <Badge tone={item.status === 'paid' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'}>
                      {PAYOUT_STATUS_LABELS[item.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
