import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Stethoscope, Heart, FileText, Briefcase, ShieldCheck, Bell, CalendarDays, History, UserRound, Wallet, LifeBuoy,
  Menu, X,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import UserMenu, { UserMenuItem } from './UserMenu'
import { hasRole } from '../utils/roles'

// Páginas de autenticación: al navegar entre ellas no deben apilarse en el historial.
const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/doctor/apply']

export default function GeneralLayout() {
  const { isAuthenticated, user } = useAuth()
  const { unread } = useNotifications()
  const location = useLocation()
  const isAuthPage = AUTH_PATHS.includes(location.pathname)
  // El chat IA ocupa toda la altura entre cabecera y footer, sin padding vertical.
  const isChatRoute =
    location.pathname.startsWith('/consultation/') && location.pathname.endsWith('/chat')

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  // Menú del paciente ordenado por utilidad: primero la actividad clínica
  // diaria, luego las preferencias y al final los paneles por rol.
  const menuGroups: UserMenuItem[][] = [
    [
      { to: '/me/consultations', label: 'Consultas IA', icon: FileText },
      { to: '/me/appointments', label: 'Citas', icon: CalendarDays },
      { to: '/me/history', label: 'Historial de orientaciones', icon: History },
    ],
    [{ to: '/me/wallet', label: 'Créditos', icon: Wallet }],
    [
      { to: '/me/favorites', label: 'Favoritos', icon: Heart },
      { to: '/me/profile', label: 'Mi perfil de paciente', icon: UserRound },
      { to: '/me/security', label: 'Seguridad', icon: ShieldCheck },
      { to: '/help', label: 'Ayuda y soporte', icon: LifeBuoy },
    ],
  ]

  // Enlaces a los paneles segun roles/capacidades.
  const roleItems: UserMenuItem[] = []
  if (hasRole(user, 'doctor') || user?.doctor_status) {
    roleItems.push({ to: '/doctor', label: 'Panel médico', icon: Briefcase })
  }
  if (hasRole(user, 'reviewer') && !hasRole(user, 'admin')) {
    roleItems.push({ to: '/reviewer/doctor-applications', label: 'Panel de revisión', icon: ShieldCheck })
  }
  if (hasRole(user, 'support') && !hasRole(user, 'admin')) {
    roleItems.push({ to: '/support/tickets', label: 'Panel de soporte', icon: LifeBuoy })
  }
  if (hasRole(user, 'admin')) {
    roleItems.push({ to: '/admin', label: 'Panel Admin', icon: ShieldCheck })
  }
  if (roleItems.length > 0) {
    menuGroups.push(roleItems)
  }

  return (
    <div
      className={`flex flex-col bg-slate-50 ${
        isChatRoute ? 'h-dvh overflow-hidden' : 'min-h-screen'
      }`}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-medium focus:text-slate-900 focus:shadow-lg focus:ring-2 focus:ring-primary-500"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <Stethoscope className="h-7 w-7 text-primary-600 sm:h-8 sm:w-8" aria-hidden="true" />
              <span className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">SabioDoc</span>
            </Link>

            <nav className="flex items-center gap-2 sm:gap-4" aria-label="Principal">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/notifications"
                    className="relative rounded-full p-2.5 text-slate-500 transition-colors hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'}
                  >
                    <Bell className="h-6 w-6" aria-hidden="true" />
                    {unread > 0 && (
                      <span
                        className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white"
                        aria-hidden="true"
                      >
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </Link>

                  <UserMenu theme="light" groups={menuGroups} nameContext="patient" />
                </>
              ) : (
                <>
                  <div className="hidden items-center gap-4 md:flex">
                    <Link
                      to="/como-funciona"
                      replace={isAuthPage}
                      className="font-medium text-slate-600 transition-colors hover:text-primary-600"
                    >
                      ¿Cómo funciona?
                    </Link>
                    <Link
                      to="/doctor/apply"
                      replace={isAuthPage}
                      className="font-medium text-slate-600 transition-colors hover:text-primary-600"
                    >
                      Soy médico
                    </Link>
                    <Link
                      to="/login"
                      replace={isAuthPage}
                      className="whitespace-nowrap font-medium text-slate-600 transition-colors hover:text-primary-600"
                    >
                      Iniciar sesión
                    </Link>
                    <Link
                      to="/register"
                      replace={isAuthPage}
                      className="whitespace-nowrap rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                    >
                      Registrarse
                    </Link>
                  </div>

                  <div className="relative md:hidden" ref={mobileMenuRef}>
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen((open) => !open)}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
                      aria-expanded={mobileMenuOpen}
                      aria-controls="mobile-nav"
                    >
                      {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
                    </button>

                    {mobileMenuOpen && (
                      <div
                        id="mobile-nav"
                        className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
                      >
                        <Link
                          to="/como-funciona"
                          replace={isAuthPage}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex min-h-[44px] items-center rounded-lg px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          ¿Cómo funciona?
                        </Link>
                        <Link
                          to="/doctor/apply"
                          replace={isAuthPage}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex min-h-[44px] items-center rounded-lg px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Soy médico
                        </Link>
                        <Link
                          to="/login"
                          replace={isAuthPage}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex min-h-[44px] items-center rounded-lg px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Iniciar sesión
                        </Link>
                        <Link
                          to="/register"
                          replace={isAuthPage}
                          onClick={() => setMobileMenuOpen(false)}
                          className="mt-1 flex min-h-[44px] items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700"
                        >
                          Registrarse
                        </Link>
                      </div>
                    )}
                  </div>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className={`mx-auto w-full max-w-6xl flex-1 px-4 ${
          isChatRoute ? 'min-h-0 overflow-hidden py-0' : 'py-8'
        }`}
      >
        <Outlet />
      </main>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-slate-500">
          <nav className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1" aria-label="Legal">
            <Link to="/telemedicina" className="inline-flex min-h-[44px] items-center px-2 py-2 text-slate-600 hover:text-primary-600 hover:underline">
              Telemedicina
            </Link>
            <Link to="/privacidad" className="inline-flex min-h-[44px] items-center px-2 py-2 text-slate-600 hover:text-primary-600 hover:underline">
              Privacidad
            </Link>
            <Link to="/terminos" className="inline-flex min-h-[44px] items-center px-2 py-2 text-slate-600 hover:text-primary-600 hover:underline">
              Términos
            </Link>
            <Link to="/help" className="inline-flex min-h-[44px] items-center px-2 py-2 text-slate-600 hover:text-primary-600 hover:underline">
              Ayuda y soporte
            </Link>
          </nav>
          <p className="font-medium">SabioDoc - Orientación médica inteligente</p>
          <p className="mt-2 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">
            ⚠️ Los servicios de IA no reemplazan una consulta médica profesional
          </p>
        </div>
      </footer>
    </div>
  )
}
