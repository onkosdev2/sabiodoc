import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Bell } from 'lucide-react'

import { useNotifications } from '../context/NotificationsContext'
import UserMenu, { UserMenuItem } from './UserMenu'

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
  navItems: PanelNavItem[]
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
  navItems,
  notificationsTo = '/notifications',
  children,
}: PanelLayoutProps) {
  const { unread } = useNotifications()
  const accentClasses = ACCENTS[accent]
  const homePath = navItems[0]?.to || '/'

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-stone-950 text-stone-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link to={homePath} className="flex min-w-0 items-center gap-3">
            <div className={`rounded-xl p-2 ${accentClasses.wrapper}`}>
              <BrandIcon className={`h-6 w-6 ${accentClasses.icon}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.28em] text-stone-400">SabioDoc</p>
              <p className="truncate text-base font-semibold leading-tight">{panelName}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to={notificationsTo}
              className="relative rounded-full p-2 text-stone-300 transition-colors hover:bg-stone-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-stone-500"
              aria-label="Notificaciones"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-stone-950">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>

            <UserMenu theme="dark" groups={[navItems as UserMenuItem[]]} showPortalGeneral />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8">{children}</main>
    </div>
  )
}
