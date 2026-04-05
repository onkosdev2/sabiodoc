import { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Stethoscope, User, LogOut, Heart, FileText, Video } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Stethoscope className="w-8 h-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-800">SabioDoc</span>
            </Link>
            
            <nav className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <Link 
                    to="/me/favorites" 
                    className="flex items-center gap-1 text-gray-600 hover:text-primary-600 transition-colors"
                  >
                    <Heart className="w-5 h-5" />
                    <span className="hidden sm:inline">Favoritos</span>
                  </Link>
                  <Link 
                    to="/me/consultations" 
                    className="flex items-center gap-1 text-gray-600 hover:text-primary-600 transition-colors"
                  >
                    <FileText className="w-5 h-5" />
                    <span className="hidden sm:inline">Consultas</span>
                  </Link>
                  {user?.role === 'doctor' && (
                    <Link 
                      to="/doctor/video-sessions" 
                      className="flex items-center gap-1 text-gray-600 hover:text-primary-600 transition-colors"
                    >
                      <Video className="w-5 h-5" />
                      <span className="hidden sm:inline">Videoconsultas</span>
                    </Link>
                  )}
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="w-5 h-5" />
                    <span className="hidden sm:inline text-sm">{user?.email}</span>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-1 text-gray-500 hover:text-red-600 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    to="/login" 
                    className="text-gray-600 hover:text-primary-600 transition-colors"
                  >
                    Iniciar sesión
                  </Link>
                  <Link 
                    to="/register" 
                    className="btn-primary"
                  >
                    Registrarse
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
      
      <footer className="bg-white border-t border-gray-100 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          <p>SabioDoc - Orientación médica inteligente</p>
          <p className="mt-1">⚠️ Este servicio no reemplaza una consulta médica profesional</p>
        </div>
      </footer>
    </div>
  )
}
