import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Bell } from 'lucide-react'

import { useNotifications } from '../context/NotificationsContext'
import UserMenu from './UserMenu'

export interface PanelNavItem {
  to: string
  label: string
  icon: LucideIcon
}

type PanelAccent = 'emerald' | 'sky' | 'violet'

interface PanelLayoutProps {
  panelName: string
  brandIcon: LucideIcon
  accent: PanelAccent
  /** Enlaces agrupados por utilidad; cada grupo se separa con un divisor. */
  menuGroups: PanelNavItem[][]
  /** Destino del icono de notificaciones (por defecto el portal de paciente). */
  notificationsTo?: string
  children: ReactNode
}

const ACCENTS: Record<PanelAccent, { wrapper: string; icon: string }> = {
  emerald: { wrapper: 'bg-emerald-400/15', icon: 'text-emerald-300' },
  sky: { wrapper: 'bg-sky-400/15', icon: 'text-sky-300' },
  violet: { wrapper: 'bg-violet-400/15', icon: 'text-violet-300' },
}

/**
 * Layout de los paneles especializados (médico, admin y revisión).
 * La navegación vive en el botón de usuario de la cabecera, igual que en la
 * pantalla principal, para dejar todo el ancho disponible al contenido.
 */
export default function PanelLayout({
  panelName,
  brandIcon: BrandIcon,
  accent,
  menuGroups,
  notificationsTo = '/notifications',
  children,
}: PanelLayoutProps) {
  const { unread } = useNotifications()
  const accentClasses = ACCENTS[accent]
  const homePath = menuGroups[0]?.[0]?.to || '/'

  return (
    <div className="min-h-screen bg-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-medium focus:text-slate-900 focus:shadow-lg focus:ring-2 focus:ring-primary-500"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-slate-950 text-slate-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link
            to={homePath}
            className="flex min-w-0 items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <div className={`rounded-xl p-2 ${accentClasses.wrapper}`}>
              <BrandIcon className={`h-6 w-6 ${accentClasses.icon}`} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">SabioDoc</p>
              <p className="truncate text-base font-semibold leading-tight">{panelName}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to={notificationsTo}
              className="relative rounded-full p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'}
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {unread > 0 && (
                <span
                  className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-slate-950"
                  aria-hidden="true"
                >
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>

            <UserMenu theme="dark" groups={menuGroups} showPortalGeneral nameContext="professional" />
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8">
        {children}
      </main>
    </div>
  )
}
