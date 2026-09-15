import { ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Bell, ChevronDown, Home, LogOut, UserRound } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'

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
  children: ReactNode
}

const ACCENTS: Record<PanelAccent, { wrapper: string; icon: string }> = {
  emerald: { wrapper: 'bg-emerald-400/15', icon: 'text-emerald-300' },
  sky: { wrapper: 'bg-sky-400/15', icon: 'text-sky-300' },
  violet: { wrapper: 'bg-violet-400/15', icon: 'text-violet-300' },
}

const ROLE_LABELS: Record<string, string> = {
  patient: 'Paciente',
  doctor: 'Médico',
  reviewer: 'Revisor',
  admin: 'Administrador',
}

/**
 * Layout de los paneles especializados (médico, admin y revisión).
 * La navegación vive en un botón de usuario en la cabecera, igual que en la
 * pantalla principal, para dejar todo el ancho disponible al contenido.
 */
export default function PanelLayout({ panelName, brandIcon: BrandIcon, accent, navItems, children }: PanelLayoutProps) {
  const { user, logout } = useAuth()
  const { unread } = useNotifications()
  const navigate = useNavigate()
  const location = useLocation()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    setIsMenuOpen(false)
    logout()
    navigate('/')
  }

  const homePath = navItems[0]?.to || '/'
  const accentClasses = ACCENTS[accent]

  const roleParts = new Set<string>()
  if (user?.role) roleParts.add(ROLE_LABELS[user.role] || user.role)
  if (user?.doctor_status) roleParts.add('Médico')
  const roleLabel = Array.from(roleParts).join(' · ')

  const isActive = (to: string) => location.pathname === to

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
              to="/notifications"
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

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full border border-stone-700 px-3 py-2 text-sm text-stone-200 transition-colors hover:border-stone-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-stone-500"
                aria-expanded={isMenuOpen}
                aria-haspopup="true"
              >
                <UserRound className="h-4 w-4" />
                <span className="hidden max-w-[180px] truncate md:inline">{user?.email}</span>
                <ChevronDown className={`h-4 w-4 text-stone-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-stone-200 bg-white text-stone-700 shadow-xl">
                  <div className="border-b border-stone-100 px-4 py-3">
                    <p className="truncate text-sm font-medium text-stone-900" title={user?.email}>
                      {user?.email}
                    </p>
                    <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-stone-400">{roleLabel}</p>
                  </div>

                  <div className="py-1">
                    {navItems.map((item) => {
                      const Icon = item.icon
                      const active = isActive(item.to)
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setIsMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                            active
                              ? 'bg-stone-100 font-medium text-stone-950'
                              : 'text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${active ? 'text-stone-900' : 'text-stone-400'}`} />
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>

                  <div className="border-t border-stone-100 py-1">
                    <Link
                      to="/"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 transition-colors hover:bg-stone-50"
                    >
                      <Home className="h-4 w-4 text-stone-400" />
                      Portal general
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8">{children}</main>
    </div>
  )
}
