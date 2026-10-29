import { useEffect, useMemo, useState } from 'react'
import { CreditCard, Plus, ShieldCheck, Trash2 } from 'lucide-react'

import {
  addPaymentMethod,
  createSetupIntent,
  deletePaymentMethod,
  getPaymentConfig,
  listPaymentMethods,
  setDefaultPaymentMethod,
  type PaymentConfig,
  type PaymentMethod,
} from '../api/payments'
import { getApiErrorMessage } from '../utils/apiError'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import ConfirmDialog from '../components/ConfirmDialog'
import PageHeader from '../components/ui/PageHeader'
import { Select } from '../components/ui/Field'
import { useToast } from '../context/ToastContext'

const MOCK_TOKEN_LABELS: Record<string, string> = {
  pm_mock_success: 'Visa •••• 4242 — pago aprobado',
  pm_mock_declined: 'Visa •••• 0002 — tarjeta rechazada',
  pm_mock_insufficient: 'Mastercard •••• 9995 — fondos insuficientes',
  pm_mock_3ds: 'Visa •••• 3220 — requiere 3DS',
  pm_mock_timeout: 'Visa •••• 1111 — timeout',
  pm_mock_expired: 'Visa •••• 4444 — expirada',
}

export default function PaymentMethods() {
  const toast = useToast()
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedToken, setSelectedToken] = useState('pm_mock_success')
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethod | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [configData, methodsData] = await Promise.all([
        getPaymentConfig(),
        listPaymentMethods(),
      ])
      setConfig(configData)
      setMethods(methodsData)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar los métodos de pago.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const mockTokens = useMemo(() => config?.mock_tokens ?? [], [config])

  const handleAdd = async () => {
    setSaving(true)
    setError(null)
    try {
      await createSetupIntent()
      await addPaymentMethod(selectedToken)
      toast.success('Método de pago agregado.')
      await load()
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No se pudo agregar el método de pago.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDefault = async (method: PaymentMethod) => {
    setSaving(true)
    setError(null)
    try {
      await setDefaultPaymentMethod(method.id)
      await load()
      toast.success('Método predeterminado actualizado.')
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No se pudo cambiar el método predeterminado.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!methodToDelete) return
    setSaving(true)
    setError(null)
    try {
      await deletePaymentMethod(methodToDelete.id)
      setMethodToDelete(null)
      await load()
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No se pudo eliminar el método de pago.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        icon={CreditCard}
        title="Métodos de pago"
        description="Administra las tarjetas con las que pagarás tus videoconsultas."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Cargando métodos de pago…</p>
        </Card>
      ) : !config?.configured ? (
        <Alert tone="warning" title="Proveedor de pagos pendiente de configuración">
          El proveedor {config?.provider} está seleccionado, pero aún faltan sus credenciales.
        </Alert>
      ) : (
        <>
          <Card>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-slate-900">Tus tarjetas</h2>
            </div>

            {methods.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                Aún no tienes una tarjeta guardada. Agrega una antes de reservar tu primera cita.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {methods.map((method) => (
                  <li key={method.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-slate-100 p-2">
                        <CreditCard className="h-5 w-5 text-slate-700" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {method.brand || 'Tarjeta'} •••• {method.last4 || '••••'}
                          {method.is_default && (
                            <Badge tone="success" className="ml-2">
                              Predeterminada
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          Vence {String(method.exp_month ?? '--').padStart(2, '0')}/
                          {method.exp_year ?? '----'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!method.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => void handleDefault(method)}
                        >
                          Hacer predeterminada
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        onClick={() => setMethodToDelete(method)}
                        leftIcon={<Trash2 className="h-4 w-4" />}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-slate-900">Agregar tarjeta</h2>
            </div>

            {config.provider === 'mock' ? (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Estás en el proveedor mock. No se solicitan datos reales de tarjeta: elige un
                  escenario de prueba.
                </p>
                <div className="mt-4 max-w-md">
                  <Select
                    label="Tarjeta de prueba"
                    value={selectedToken}
                    onChange={(event) => setSelectedToken(event.target.value)}
                  >
                    {mockTokens.map((token) => (
                      <option key={token} value={token}>
                        {MOCK_TOKEN_LABELS[token] ?? token}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                El formulario seguro del proveedor se habilitará cuando se conecte la pasarela real.
              </p>
            )}

            <Button
              className="mt-4"
              onClick={() => void handleAdd()}
              loading={saving}
              disabled={config.provider !== 'mock'}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Agregar tarjeta
            </Button>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={methodToDelete !== null}
        tone="danger"
        title="¿Eliminar método de pago?"
        description={
          methodToDelete
            ? `Se eliminará ${methodToDelete.brand ?? 'la tarjeta'} •••• ${methodToDelete.last4 ?? '••••'}. Si es tu única tarjeta, no podrás reservar hasta agregar otra.`
            : ''
        }
        confirmLabel="Eliminar"
        busy={saving}
        onConfirm={handleDelete}
        onCancel={() => setMethodToDelete(null)}
      />
    </div>
  )
}
