import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Cpu, RefreshCcw, ServerOff } from 'lucide-react'

import { LlmHealthResponse, getLlmHealth } from '../api/admin'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import type { BadgeTone } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'

export default function AdminSystemHealth() {
  const toast = useToast()
  const [health, setHealth] = useState<LlmHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadHealth = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getLlmHealth()
      setHealth(data)
      setLastUpdated(new Date())
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo consultar el estado de la IA'))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadHealth()
  }, [loadHealth])

  // Refresco automático cada 30 segundos.
  useEffect(() => {
    const interval = window.setInterval(loadHealth, 30000)
    return () => window.clearInterval(interval)
  }, [loadHealth])

  const overall = (() => {
    if (!health) return null
    if (health.mode === 'mock') {
      return { label: 'Modo mock (sin API keys)', tone: 'neutral' as BadgeTone, dot: 'bg-slate-400' }
    }
    if (health.healthy) {
      return { label: 'Operativo', tone: 'success' as BadgeTone, dot: 'bg-emerald-500' }
    }
    return { label: 'Degradado: ningún proveedor responde', tone: 'danger' as BadgeTone, dot: 'bg-red-500' }
  })()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estado de la IA"
        description="Disponibilidad de los proveedores de IA. DeepSeek es el principal y Groq el respaldo automático; si uno falla, el sistema sigue respondiendo con el otro."
        actions={
          <Button
            variant="secondary"
            onClick={loadHealth}
            disabled={loading}
            leftIcon={<RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            {loading ? 'Consultando...' : 'Actualizar'}
          </Button>
        }
      />

      {overall && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone={overall.tone} icon={<span className={`h-2.5 w-2.5 rounded-full ${overall.dot}`} />}>
            {overall.label}
          </Badge>
          {lastUpdated && (
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Última consulta: {lastUpdated.toLocaleTimeString('es-ES')}
            </span>
          )}
        </div>
      )}

      {loading && !health ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : health && health.providers.length === 0 ? (
        <EmptyState
          icon={ServerOff}
          title="Sin proveedores de IA configurados"
          description="El sistema usa respuestas locales (modo mock) hasta que configures una API key."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {health?.providers.map((provider, index) => {
            const ok = provider.status === 'ok'
            const isPrimary = index === 0
            return (
              <section
                key={provider.name}
                className={`rounded-2xl border bg-white p-6 shadow-sm ${ok ? 'border-slate-200' : 'border-red-200'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-2xl p-2 ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {ok ? (
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-semibold capitalize text-slate-950">{provider.name}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        {isPrimary ? 'Principal' : 'Respaldo (fallback)'}
                      </p>
                    </div>
                  </div>
                  <Badge tone={ok ? 'success' : 'danger'}>{ok ? 'Operativo' : 'Con fallas'}</Badge>
                </div>

                <dl className="mt-5 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Modelo</dt>
                    <dd className="font-medium text-slate-900">{provider.model}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Latencia</dt>
                    <dd className="font-medium text-slate-900">
                      {provider.latency_ms != null ? `${provider.latency_ms} ms` : '-'}
                    </dd>
                  </div>
                </dl>

                {provider.detail && (
                  <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {provider.detail}
                  </p>
                )}
              </section>
            )
          })}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Cpu className="h-5 w-5 text-sky-600" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-950">¿Cómo funciona el respaldo?</h2>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            Si DeepSeek falla, no responde o supera el timeout, la petición se reintenta automáticamente con Groq.
          </li>
          <li className="flex gap-2">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            También se usa Groq si DeepSeek devuelve una respuesta con formato inválido.
          </li>
          <li className="flex gap-2">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            Si ninguno responde, el sistema usa respuestas locales para no dejar de funcionar.
          </li>
        </ul>
      </section>

      {!loading && !health && (
        <Alert tone="danger" title="No se pudo consultar el estado">
          Vuelve a intentarlo en unos segundos. Si persiste, puede que un bloqueador de
          anuncios (uBlock Origin, AdBlock…) esté bloqueando la petición: pruébalo
          desactivándolo para este sitio.
        </Alert>
      )}
    </div>
  )
}
