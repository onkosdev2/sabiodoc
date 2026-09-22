import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CreditCard,
  Info,
  RefreshCcw,
  Wallet as WalletIcon,
} from 'lucide-react'

import {
  getMyWallet,
  getMyWithdrawals,
  requestWithdrawal,
  topupCredits,
  Wallet,
  WalletTransaction,
  WalletTransactionType,
  Withdrawal,
} from '../api/wallet'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import { formatMoney } from '../utils/format'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'

interface WalletPageProps {
  audience?: 'patient' | 'professional'
}

const QUICK_TOPUPS = [1000, 2000, 5000, 10000]

const TRANSACTION_LABELS: Record<WalletTransactionType, string> = {
  topup: 'Recarga',
  withdrawal: 'Retiro',
  consultation_payment: 'Pago de consulta',
  consultation_income: 'Ingreso por consulta',
  refund: 'Reembolso',
  adjustment: 'Ajuste',
}

const WITHDRAWAL_STATUS_LABELS: Record<Withdrawal['status'], string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  rejected: 'Rechazado',
}

const WITHDRAWAL_TONES: Record<Withdrawal['status'], 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  paid: 'success',
  rejected: 'danger',
}

function TransactionRow({ transaction }: { transaction: WalletTransaction }) {
  const isCredit = transaction.amount_cents >= 0
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${
            isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}
          aria-hidden="true"
        >
          {isCredit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">
            {TRANSACTION_LABELS[transaction.type] ?? transaction.type}
          </p>
          <p className="truncate text-xs text-slate-500">{transaction.description}</p>
        </div>
      </div>
      <div className="flex-none text-right">
        <p className={`text-sm font-semibold ${isCredit ? 'text-emerald-700' : 'text-rose-700'}`}>
          {isCredit ? '+' : '−'}
          {formatMoney(Math.abs(transaction.amount_cents))}
        </p>
        <p className="text-xs text-slate-500">
          {transaction.status === 'pending' ? 'Pendiente · ' : ''}
          {new Date(transaction.created_at).toLocaleDateString('es-ES')}
        </p>
      </div>
    </li>
  )
}

export default function WalletPage({ audience = 'patient' }: WalletPageProps) {
  const toast = useToast()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState('10')
  const [topupLoading, setTopupLoading] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawDestination, setWithdrawDestination] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [walletData, withdrawalsData] = await Promise.all([getMyWallet(), getMyWithdrawals()])
      setWallet(walletData)
      setWithdrawals(withdrawalsData.withdrawals)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar tu monedero de créditos.'))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const topupCents = useMemo(() => Math.round(Number(topupAmount.replace(',', '.')) * 100), [topupAmount])
  const withdrawCents = useMemo(() => Math.round(Number(withdrawAmount.replace(',', '.')) * 100), [withdrawAmount])

  const handleTopup = async () => {
    if (!Number.isFinite(topupCents) || topupCents <= 0) {
      toast.error('Ingresa un monto válido para recargar.')
      return
    }
    setTopupLoading(true)
    try {
      const updated = await topupCredits(topupCents)
      setWallet(updated)
      toast.success(`Recargaste ${formatMoney(topupCents)} en créditos.`)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo completar la recarga.'))
    } finally {
      setTopupLoading(false)
    }
  }

  const handleWithdraw = async () => {
    if (!Number.isFinite(withdrawCents) || withdrawCents <= 0) {
      toast.error('Ingresa un monto válido para retirar.')
      return
    }
    if (withdrawDestination.trim().length < 3) {
      toast.error('Indica la cuenta de destino del retiro.')
      return
    }
    setWithdrawLoading(true)
    try {
      const created = await requestWithdrawal(withdrawCents, withdrawDestination.trim())
      setWithdrawals((current) => [created, ...current])
      const updated = await getMyWallet()
      setWallet(updated)
      setWithdrawAmount('')
      setWithdrawDestination('')
      toast.success('Solicitud de retiro enviada. Quedará pendiente de revisión.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo solicitar el retiro.'))
    } finally {
      setWithdrawLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (!wallet) {
    return (
      <div className="space-y-4">
        <Alert tone="danger">No se pudo cargar tu monedero.</Alert>
        <Button variant="secondary" onClick={load} leftIcon={<RefreshCcw className="h-4 w-4" />}>
          Reintentar
        </Button>
      </div>
    )
  }

  const balanceCents = wallet.balance_cents
  const withdrawTooMuch = Number.isFinite(withdrawCents) && withdrawCents > balanceCents

  return (
    <div className="space-y-6">
      <PageHeader
        icon={WalletIcon}
        title={audience === 'professional' ? 'Mis ingresos' : 'Mis créditos'}
        description="Los créditos sirven para pagar videoconsultas. 1 crédito = 1 USD."
      />

      <Alert tone="info" title="Dinero de prueba">
        Esta billetera usa dinero ficticio mientras no se integre la pasarela de pagos real.
      </Alert>

      {/* Saldo */}
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-600 to-teal-600 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-100">Saldo disponible</p>
            <p className="mt-2 text-4xl font-bold tabular-nums">{formatMoney(balanceCents)}</p>
            <p className="mt-1 text-sm text-emerald-100">{wallet.credits} créditos</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-emerald-50">
            <p>
              Recarga mínima: <span className="font-semibold">{formatMoney(wallet.min_topup_cents)}</span>
            </p>
            <p className="mt-1">
              Retiro mínimo: <span className="font-semibold">{formatMoney(wallet.min_withdrawal_cents)}</span>
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recargar */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700">
            <CreditCard className="h-5 w-5" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-slate-900">Recargar créditos</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">Añade saldo de prueba a tu monedero.</p>

          <div className="mt-4">
            <label htmlFor="topup-amount" className="mb-1 block text-sm font-medium text-slate-700">
              Monto (USD)
            </label>
            <input
              id="topup-amount"
              type="number"
              min="1"
              step="0.01"
              inputMode="decimal"
              value={topupAmount}
              onChange={(event) => setTopupAmount(event.target.value)}
              className="input-field"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_TOPUPS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setTopupAmount(String(amount / 100))}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-emerald-400 hover:text-emerald-700"
              >
                {formatMoney(amount)}
              </button>
            ))}
          </div>

          <Button
            className="mt-4 w-full"
            onClick={handleTopup}
            loading={topupLoading}
            disabled={!Number.isFinite(topupCents) || topupCents <= 0}
            leftIcon={<CreditCard className="h-4 w-4" />}
          >
            Recargar {Number.isFinite(topupCents) && topupCents > 0 ? formatMoney(topupCents) : ''}
          </Button>
        </section>

        {/* Retirar */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sky-700">
            <Banknote className="h-5 w-5" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-slate-900">Retirar a mi cuenta</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Convierte créditos en dinero. La solicitud queda pendiente de aprobación.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="withdraw-amount" className="mb-1 block text-sm font-medium text-slate-700">
                Monto (USD)
              </label>
              <input
                id="withdraw-amount"
                type="number"
                min="1"
                step="0.01"
                inputMode="decimal"
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                className="input-field"
                placeholder="0.00"
                aria-invalid={withdrawTooMuch}
              />
            </div>
            <div>
              <label htmlFor="withdraw-destination" className="mb-1 block text-sm font-medium text-slate-700">
                Cuenta destino
              </label>
              <input
                id="withdraw-destination"
                type="text"
                value={withdrawDestination}
                onChange={(event) => setWithdrawDestination(event.target.value)}
                className="input-field"
                placeholder="Banco, número de cuenta o alias"
                maxLength={255}
              />
            </div>
          </div>

          {withdrawTooMuch && (
            <p className="mt-2 text-sm text-rose-600" role="alert">
              El monto supera tu saldo disponible.
            </p>
          )}

          <Button
            variant="secondary"
            className="mt-4 w-full"
            onClick={handleWithdraw}
            loading={withdrawLoading}
            disabled={
              !Number.isFinite(withdrawCents) ||
              withdrawCents <= 0 ||
              withdrawTooMuch ||
              withdrawDestination.trim().length < 3
            }
            leftIcon={<Banknote className="h-4 w-4" />}
          >
            Solicitar retiro
          </Button>
        </section>
      </div>

      {/* Movimientos */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Movimientos recientes</h2>
          <Button variant="ghost" size="sm" onClick={load} leftIcon={<RefreshCcw className="h-4 w-4" />}>
            Actualizar
          </Button>
        </div>

        {wallet.transactions.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
            <Info className="h-4 w-4" aria-hidden="true" />
            Todavía no tienes movimientos.
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {wallet.transactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </ul>
        )}
      </section>

      {/* Retiros */}
      {withdrawals.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Mis solicitudes de retiro</h2>
          <ul className="mt-4 space-y-3">
            {withdrawals.map((withdrawal) => (
              <li
                key={withdrawal.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{formatMoney(withdrawal.amount_cents)}</p>
                  <p className="truncate text-xs text-slate-500">{withdrawal.destination}</p>
                  {withdrawal.admin_notes && (
                    <p className="mt-1 text-xs text-slate-500">Nota: {withdrawal.admin_notes}</p>
                  )}
                </div>
                <Badge tone={WITHDRAWAL_TONES[withdrawal.status]}>
                  {WITHDRAWAL_STATUS_LABELS[withdrawal.status]}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {audience === 'patient' && (
        <p className="text-center text-sm text-slate-500">
          ¿Buscas agendar? <Link to="/specialties" className="text-primary-600 hover:text-primary-700">Ver especialidades</Link>
        </p>
      )}
    </div>
  )
}
