import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../utils/cn'

interface PageHeaderProps {
  icon?: LucideIcon
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

/** Encabezado de página consistente (título + descripción + acciones). */
export default function PageHeader({ icon: Icon, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="rounded-2xl bg-primary-100 p-2.5 text-primary-600" aria-hidden="true">
            <Icon className="h-6 w-6" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
