import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Stethoscope, Heart, FileText, Briefcase, ShieldCheck, Bell, CalendarDays,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import UserMenu, { UserMenuItem } from './UserMenu'

interface GeneralLayoutProps {
  children: ReactNode
}

// Páginas de autenticación: al navegar entre ellas no deben apilarse en el historial.
const AUTH_PATHS = ['/login', '/register', '/doctor/apply']

export default function GeneralLayout({ children }: GeneralLayoutProps) {
  const { isAuthenticated, user } = useAuth()
  const { unread } = useNotifications()
  const location = useLocation()
  const isAuthPage = AUTH_PATHS.includes(location.pathname)

  // Enlaces generales del paciente
  const menuGroups: UserMenuItem[][] = [
    [
      { to: '/me/favorites', label: 'Favoritos', icon: Heart },
      { to: '/me/consultations', label: 'Consultas', icon: FileText },
      { to: '/me/appointments', label: 'Citas', icon: CalendarDays },
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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded">
              <Stethoscope className="w-8 h-8 text-primary-600" aria-hidden="true" />
              <span className="text-2xl font-bold text-gray-800 tracking-tight">SabioDoc</span>
            </Link>

            <nav className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/notifications"
                    className="text-gray-500 hover:text-primary-600 transition-colors relative p-1 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-full"
                    aria-label="Notificaciones"
                  >
                    <Bell className="w-6 h-6" aria-hidden="true" />
                    {unread > 0 && (
                      <span
                        className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white"
                        aria-label={`${unread} notificaciones sin leer`}
                      >
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </Link>

                  <UserMenu theme="light" groups={menuGroups} />
                </>
              ) : (
                <>
                  <Link
                    to="/doctor/apply"
                    replace={isAuthPage}
                    className="hidden text-gray-600 hover:text-primary-600 transition-colors md:inline-flex font-medium"
                  >
                    Soy médico
                  </Link>
                  <Link
                    to="/login"
                    replace={isAuthPage}
                    className="text-gray-600 hover:text-primary-600 transition-colors font-medium"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    to="/register"
                    replace={isAuthPage}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    Registrarse
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          <p className="font-medium">SabioDoc - Orientación médica inteligente</p>
          <p className="mt-2 text-amber-600 bg-amber-50 inline-block px-3 py-1 rounded-full text-xs">
            ⚠️ Los servicios de IA no reemplazan una consulta médica profesional
          </p>
        </div>
      </footer>
    </div>
  )
}
