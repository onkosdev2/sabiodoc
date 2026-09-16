import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown, Home, LogOut, UserRound } from 'lucide-react'

import { useAuth } from '../context/AuthContext'

export interface UserMenuItem {
  to: string
  label: string
  icon: LucideIcon
}

interface UserMenuProps {
  /** "light" sobre cabecera clara (portal), "dark" sobre cabecera oscura (paneles). */
  theme: 'light' | 'dark'
  /** Grupos de enlaces, separados visualmente por divisores. */
  groups: UserMenuItem[][]
  /** Mostrar enlace "Portal general" (util dentro de los paneles). */
  showPortalGeneral?: boolean
}

const ROLE_LABELS: Record<string, string> = {
  patient: 'Paciente',
  doctor: 'Médico',
  reviewer: 'Revisor',
  admin: 'Administrador',
}

/**
 * Botón de usuario + dropdown compartido por el portal de paciente y los
 * paneles de medico/admin/revisor, para que su aspecto sea consistente.
 */
export default function UserMenu({ theme, groups, showPortalGeneral = false }: UserMenuProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    setIsOpen(false)
    logout()
    navigate('/')
  }

  const roleParts = new Set<string>()
  if (user?.role) roleParts.add(ROLE_LABELS[user.role] || user.role)
  if (user?.doctor_status) roleParts.add('Médico')
  const roleLabel = Array.from(roleParts).join(' · ')

  const buttonTheme =
    theme === 'dark'
      ? 'border border-stone-700 text-stone-200 hover:border-stone-500 hover:text-white focus:ring-stone-500'
      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 focus:ring-primary-500'

  const visibleGroups = groups.filter((group) => group.length > 0)

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((open) => !open)}
        className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 ${buttonTheme}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Menú de usuario"
      >
        Perfil
        <UserRound className="h-4 w-4" />
        <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-stone-200 bg-white text-stone-700 shadow-xl">
          <div className="border-b border-stone-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-stone-900" title={user?.email}>
              {user?.email}
            </p>
            <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-stone-400">{roleLabel}</p>
          </div>

          {visibleGroups.map((group, index) => (
            <div
              key={group.map((item) => item.to).join('|')}
              className={`py-1 ${index > 0 ? 'border-t border-stone-100' : ''}`}
            >
              {group.map((item) => {
                const Icon = item.icon
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      active ? 'bg-stone-100 font-medium text-stone-950' : 'text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-stone-900' : 'text-stone-400'}`} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}

          <div className="border-t border-stone-100 py-1">
            {showPortalGeneral && (
              <Link
                to="/"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 transition-colors hover:bg-stone-50"
              >
                <Home className="h-4 w-4 text-stone-400" />
                Portal general
              </Link>
            )}
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
  )
}
