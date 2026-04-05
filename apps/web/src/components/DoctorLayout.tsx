import { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Activity, Bell, Briefcase, CalendarDays, FileText, Home, LogOut, UserRound } from 'lucide-react'

interface DoctorLayoutProps {
  children: ReactNode
}

export default function DoctorLayout({ children }: DoctorLayoutProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea]">
      <header className="border-b border-stone-200 bg-stone-950 text-stone-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link to="/doctor" className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-400/15 p-2">
              <Briefcase className="h-7 w-7 text-emerald-300" />
              </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-stone-400">SabioDoc</p>
              <p className="text-lg font-semibold">Panel Médico</p>
            </div>
          </Link>

          <div className="flex items-center gap-3 text-sm">
            <Link to="/" className="inline-flex items-center gap-2 text-stone-300 hover:text-white">
              <Home className="h-4 w-4" />
              Portal general
            </Link>
            <div className="hidden items-center gap-2 rounded-full border border-stone-700 px-3 py-1 text-stone-300 md:inline-flex">
              <UserRound className="h-4 w-4" />
              {user?.email}
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-stone-700 px-3 py-1 text-stone-300 hover:border-red-400 hover:text-red-300"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8">
        <aside className="hidden w-64 shrink-0 rounded-3xl bg-stone-900 p-5 text-stone-100 lg:block">
          <p className="mb-4 text-xs uppercase tracking-[0.28em] text-stone-400">Navegación</p>
          <nav className="space-y-2">
            <Link
              to="/doctor"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-stone-200 transition-colors hover:bg-stone-800"
            >
              <CalendarDays className="h-4 w-4 text-emerald-300" />
              Dashboard
            </Link>
            <Link
              to="/doctor/video-sessions"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-stone-200 transition-colors hover:bg-stone-800"
            >
              <Activity className="h-4 w-4 text-emerald-300" />
              Videoconsultas
            </Link>
            <Link
              to="/doctor/availability"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-stone-200 transition-colors hover:bg-stone-800"
            >
              <CalendarDays className="h-4 w-4 text-emerald-300" />
              Disponibilidad
            </Link>
            <Link
              to="/notifications"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-stone-200 transition-colors hover:bg-stone-800"
            >
              <Bell className="h-4 w-4 text-emerald-300" />
              Notificaciones
            </Link>
            <Link
              to="/doctor/profile"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-stone-200 transition-colors hover:bg-stone-800"
            >
              <FileText className="h-4 w-4 text-emerald-300" />
              Perfil médico
            </Link>
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
