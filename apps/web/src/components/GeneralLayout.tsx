import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Stethoscope, Heart, FileText, Briefcase, ShieldCheck, Bell, CalendarDays, History, UserRound, Wallet,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import UserMenu, { UserMenuItem } from './UserMenu'

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
    ],
  ]

  // Enlaces a los paneles segun rol/capacidades
  const roleItems: UserMenuItem[] = []
  if (user?.role === 'doctor' || user?.doctor_status) {
    roleItems.push({ to: '/doctor', label: 'Panel médico', icon: Briefcase })
  }
  if ((user?.is_reviewer || user?.role === 'reviewer') && user?.role !== 'admin') {
    roleItems.push({ to: '/reviewer/doctor-applications', label: 'Panel de revisión', icon: ShieldCheck })
  }
  if (user?.role === 'admin') {
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
              <Stethoscope className="h-8 w-8 text-primary-600" aria-hidden="true" />
              <span className="text-2xl font-bold tracking-tight text-slate-800">SabioDoc</span>
            </Link>

            <nav className="flex items-center gap-4" aria-label="Principal">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/notifications"
                    className="relative rounded-full p-1 text-slate-500 transition-colors hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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
                  <Link
                    to="/doctor/apply"
                    replace={isAuthPage}
                    className="hidden font-medium text-slate-600 transition-colors hover:text-primary-600 md:inline-flex"
                  >
                    Soy médico
                  </Link>
                  <Link
                    to="/login"
                    replace={isAuthPage}
                    className="font-medium text-slate-600 transition-colors hover:text-primary-600"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    to="/register"
                    replace={isAuthPage}
                    className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  >
                    Registrarse
                  </Link>
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
          <p className="font-medium">SabioDoc - Orientación médica inteligente</p>
          <p className="mt-2 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-600">
            ⚠️ Los servicios de IA no reemplazan una consulta médica profesional
          </p>
        </div>
      </footer>
    </div>
  )
}
