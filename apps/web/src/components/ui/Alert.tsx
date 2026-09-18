import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

import { cn } from '../../utils/cn'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const TONES: Record<AlertTone, { className: string; Icon: typeof Info }> = {
  info: { className: 'border-sky-200 bg-sky-50 text-sky-800', Icon: Info },
  success: { className: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2 },
  warning: { className: 'border-amber-200 bg-amber-50 text-amber-800', Icon: AlertTriangle },
  danger: { className: 'border-red-200 bg-red-50 text-red-700', Icon: AlertCircle },
}

interface AlertProps {
  tone?: AlertTone
  title?: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}

/** Mensaje de estado consistente (info/éxito/aviso/error). */
export default function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  const { className: toneClass, Icon } = TONES[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-2xl border p-4', toneClass, className)}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={cn(title && 'mt-1')}>{children}</div>}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  )
}
