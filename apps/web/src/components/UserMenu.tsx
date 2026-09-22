import { useEffect, useId, useRef, useState } from 'react'
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
  /**
   * Contexto del panel para elegir qué nombre mostrar:
   * "patient" -> nombre del perfil de paciente; "professional" -> nombre del perfil médico.
   */
  nameContext?: 'patient' | 'professional'
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
export default function UserMenu({ theme, groups, showPortalGeneral = false, nameContext = 'professional' }: UserMenuProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

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

  // Accesibilidad: Escape cierra el menú y devuelve el foco al botón.
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleLogout = () => {
    setIsOpen(false)
    logout()
    navigate('/')
  }

  const roleParts = new Set<string>()
  if (user?.role) roleParts.add(ROLE_LABELS[user.role] || user.role)
  if (user?.doctor_status) roleParts.add('Médico')
  const roleLabel = Array.from(roleParts).join(' · ')

  // El nombre mostrado depende del contexto: en el portal del paciente usamos su
  // perfil de paciente; en los paneles profesionales, el nombre del médico.
  const contextualName =
    nameContext === 'patient'
      ? user?.patient_display_name
      : user?.doctor_display_name || user?.display_name
  const primaryName = contextualName || user?.email

  const buttonTheme =
    theme === 'dark'
      ? 'border border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white focus:ring-slate-500'
      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 focus:ring-primary-500'

  const visibleGroups = groups.filter((group) => group.length > 0)

  return (
    <div className="relative" ref={menuRef}>
      <button type="button"
        ref={buttonRef}
        onClick={() => setIsOpen((open) => !open)}
        className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${buttonTheme}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls={menuId}
        aria-label="Menú de usuario"
      >
        Perfil
        <UserRound className="h-4 w-4" />
        <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          id={menuId}
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-xl"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p
              className="truncate text-sm font-medium text-slate-900"
              title={primaryName}
            >
              {primaryName}
            </p>
            {contextualName && <p className="truncate text-xs text-slate-500">{user?.email}</p>}
            <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-slate-500">{roleLabel}</p>
          </div>

          {visibleGroups.map((group, index) => (
            <div
              key={group.map((item) => item.to).join('|')}
              className={`py-1 ${index > 0 ? 'border-t border-slate-100' : ''}`}
            >
              {group.map((item) => {
                const Icon = item.icon
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      active ? 'bg-slate-100 font-medium text-slate-950' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-slate-900' : 'text-slate-500'}`} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}

          <div className="border-t border-slate-100 py-1">
            {showPortalGeneral && (
              <Link
                to="/"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Home className="h-4 w-4 text-slate-500" />
                Portal general
              </Link>
            )}
            <button type="button"
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
