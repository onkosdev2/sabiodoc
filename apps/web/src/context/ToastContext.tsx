import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

import { cn } from '../utils/cn'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastOptions {
  title?: string
  /** ms antes de auto-cerrar; 0 = no se cierra solo */
  duration?: number
}

export interface ToastItem {
  id: number
  tone: ToastTone
  message: string
  title?: string
  duration: number
}

interface ToastActions {
  dismiss: (id: number) => void
  success: (message: string, options?: ToastOptions) => number
  error: (message: string, options?: ToastOptions) => number
  info: (message: string, options?: ToastOptions) => number
  warning: (message: string, options?: ToastOptions) => number
}

const ToastContext = createContext<ToastActions | undefined>(undefined)

const TONES: Record<ToastTone, { className: string; Icon: typeof Info }> = {
  success: { className: 'border-emerald-200 bg-emerald-50 text-emerald-900', Icon: CheckCircle2 },
  error: { className: 'border-red-200 bg-red-50 text-red-900', Icon: AlertCircle },
  info: { className: 'border-sky-200 bg-sky-50 text-sky-900', Icon: Info },
  warning: { className: 'border-amber-200 bg-amber-50 text-amber-900', Icon: AlertTriangle },
}

const MAX_TOASTS = 4

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone, message: string, options?: ToastOptions) => {
      const id = ++counter.current
      const duration = options?.duration ?? (tone === 'error' ? 6000 : 4000)
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, tone, message, title: options?.title, duration }])
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss],
  )

  // Las acciones son estables (no dependen del estado de toasts) para poder
  // usarlas dentro de useEffect sin re-disparar el efecto.
  const value = useMemo<ToastActions>(
    () => ({
      dismiss,
      success: (message, options) => push('success', message, options),
      error: (message, options) => push('error', message, options),
      info: (message, options) => push('info', message, options),
      warning: (message, options) => push('warning', message, options),
    }),
    [dismiss, push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:items-end">
      <div aria-live="polite" aria-atomic="true" className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => {
          const { className, Icon } = TONES[toast.tone]
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-2xl border p-3 shadow-sm animate-slide-up',
                className,
              )}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
                <p className={cn('text-sm', toast.title && 'mt-0.5')}>{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Cerrar notificación"
                className="shrink-0 rounded-lg p-1 text-current/70 transition-colors hover:bg-black/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function useToast(): ToastActions {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast debe usarse dentro de ToastProvider')
  }
  return context
}
