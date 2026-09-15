import { ReactNode, useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { 
  Stethoscope, User, LogOut, Heart, FileText, 
  Briefcase, ShieldCheck, Bell, CalendarDays, ChevronDown 
} from 'lucide-react'

interface GeneralLayoutProps {
  children: ReactNode
}

export default function GeneralLayout({ children }: GeneralLayoutProps) {
  const { isAuthenticated, user, logout } = useAuth()
  const { unread } = useNotifications()
  const navigate = useNavigate()
  
  // Estado y ref para el menú desplegable
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  // Cerrar el menú si se hace clic fuera de él
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded">
              <Stethoscope className="w-8 h-8 text-primary-600" aria-hidden="true" />
              <span className="text-2xl font-bold text-gray-800 tracking-tight">SabioDoc</span>
            </Link>

            <nav className="flex items-center gap-5">
              {isAuthenticated ? (
                <>
                  {/* Botón de Notificaciones (Siempre visible) */}
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

                  {/* Menú Desplegable de Usuario */}
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="flex items-center gap-2 text-gray-600 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                      aria-expanded={isMenuOpen}
                      aria-haspopup="true"
                    >
                      Perfil
                      <User className="w-5 h-5" />
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Contenido del Dropdown */}
                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50">
                        {/* Cabecera con el Email */}
                        <div className="px-4 py-2 border-b border-gray-50 mb-1">
                          <p className="text-sm font-medium text-gray-900 truncate" title={user?.email}>
                            {user?.email}
                          </p>
                        </div>

                        {/* Enlaces Generales */}
                        <Link 
                          to="/me/favorites" 
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors"
                        >
                          <Heart className="w-4 h-4" /> Favoritos
                        </Link>
                        <Link 
                          to="/me/consultations" 
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors"
                        >
                          <FileText className="w-4 h-4" /> Consultas
                        </Link>
                        <Link 
                          to="/me/appointments" 
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors"
                        >
                          <CalendarDays className="w-4 h-4" /> Citas
                        </Link>

                        {/* Separador para roles especiales */}
                        {(user?.role === 'doctor' || user?.role === 'admin' || user?.role === 'reviewer' || user?.doctor_status) && (
                          <div className="border-t border-gray-50 my-1"></div>
                        )}
                        
                        {/* Enlaces por Rol */}
                        {(user?.role === 'doctor' || user?.doctor_status) && (
                          <Link 
                            to="/doctor" 
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors"
                          >
                            <Briefcase className="w-4 h-4" /> Panel médico
                          </Link>
                        )}
                        {user?.role === 'reviewer' && (
                          <Link 
                            to="/reviewer/doctor-applications" 
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors"
                          >
                            <ShieldCheck className="w-4 h-4" /> Panel de revisión
                          </Link>
                        )}
                        {user?.role === 'admin' && (
                          <Link 
                            to="/admin" 
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors"
                          >
                            <ShieldCheck className="w-4 h-4" /> Panel Admin
                          </Link>
                        )}

                        <div className="border-t border-gray-50 my-1"></div>

                        {/* Acción Destructiva */}
                        <button
                          onClick={() => {
                            setIsMenuOpen(false)
                            handleLogout()
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                        >
                          <LogOut className="w-4 h-4" /> Cerrar sesión
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/doctor/apply"
                    className="hidden text-gray-600 hover:text-primary-600 transition-colors md:inline-flex font-medium"
                  >
                    Soy médico
                  </Link>
                  <Link 
                    to="/login" 
                    className="text-gray-600 hover:text-primary-600 transition-colors font-medium"
                  >
                    Iniciar sesión
                  </Link>
                  <Link 
                    to="/register" 
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