import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Cpu, Loader2, RefreshCcw, ServerOff } from 'lucide-react'

import { LlmHealthResponse, getLlmHealth } from '../api/admin'

export default function AdminSystemHealth() {
  const [health, setHealth] = useState<LlmHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getLlmHealth()
      setHealth(data)
      setLastUpdated(new Date())
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { detail?: string } } }
      setError(requestError.response?.data?.detail || 'No se pudo consultar el estado de la IA')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHealth()
  }, [loadHealth])

  // Refresco automático cada 30 segundos
  useEffect(() => {
    const interval = window.setInterval(loadHealth, 30000)
    return () => window.clearInterval(interval)
  }, [loadHealth])

  const overall = (() => {
    if (!health) return null
    if (health.mode === 'mock') {
      return { label: 'Modo mock (sin API keys)', tone: 'bg-stone-100 text-stone-700 border-stone-200', dot: 'bg-stone-400' }
    }
    if (health.healthy) {
      return { label: 'Operativo', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
    }
    return { label: 'Degradado: ningún proveedor responde', tone: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' }
  })()

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sky-700">Admin</p>
            <h1 className="mt-2 text-3xl font-bold text-stone-950">Estado de la IA</h1>
            <p className="mt-2 max-w-3xl text-stone-600">
              Disponibilidad de los proveedores de IA. DeepSeek es el principal y Groq el respaldo
              automático; si uno falla, el sistema sigue respondiendo con el otro.
            </p>
          </div>
          <button
            onClick={loadHealth}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:border-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Consultando...' : 'Actualizar'}
          </button>
        </div>

        {overall && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${overall.tone}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${overall.dot}`} />
              {overall.label}
            </span>
            {lastUpdated && (
              <span className="text-xs uppercase tracking-[0.18em] text-stone-400">
                Última consulta: {lastUpdated.toLocaleTimeString('es-ES')}
              </span>
            )}
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      )}

      {loading && !health ? (
        <div className="flex min-h-[200px] items-center justify-center text-stone-500">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Consultando proveedores de IA...
        </div>
      ) : health && health.providers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-stone-500">
          <ServerOff className="mx-auto mb-3 h-8 w-8 text-stone-400" />
          No hay proveedores de IA configurados. El sistema usa respuestas locales (modo mock).
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {health?.providers.map((provider, index) => {
            const ok = provider.status === 'ok'
            const isPrimary = index === 0
            return (
              <section
                key={provider.name}
                className={`rounded-[32px] border bg-white p-6 shadow-sm ${ok ? 'border-stone-200' : 'border-red-200'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-2xl p-2 ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {ok ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-lg font-semibold capitalize text-stone-950">{provider.name}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                        {isPrimary ? 'Principal' : 'Respaldo (fallback)'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                      ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {ok ? 'Operativo' : 'Con fallas'}
                  </span>
                </div>

                <dl className="mt-5 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-stone-500">Modelo</dt>
                    <dd className="font-medium text-stone-900">{provider.model}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-stone-500">Latencia</dt>
                    <dd className="font-medium text-stone-900">
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

      <section className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Cpu className="h-5 w-5 text-sky-600" />
          <h2 className="text-lg font-semibold text-stone-950">¿Cómo funciona el respaldo?</h2>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-stone-600">
          <li>• Si DeepSeek falla, no responde o supera el timeout, la petición se reintenta automáticamente con Groq.</li>
          <li>• También se usa Groq si DeepSeek devuelve una respuesta con formato inválido.</li>
          <li>• Si ninguno responde, el sistema usa respuestas locales para no dejar de funcionar.</li>
        </ul>
      </section>
    </div>
  )
}
