import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, getMe } from '../api/auth'
import { heartbeatPresence } from '../api/doctors'
import { clearStoredAuth, getStoredToken, setStoredAuth, setStoredUser } from '../utils/authStorage'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, user: User, remember?: boolean) => void
  logout: () => void
  refreshUser: () => Promise<User | null>
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(getStoredToken())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getStoredToken()
      if (storedToken) {
        try {
          const userData = await getMe()
          setUser(userData)
          setToken(storedToken)
        } catch {
          clearStoredAuth()
          setToken(null)
          setUser(null)
        }
      }
      setIsLoading(false)
    }
    initAuth()
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredAuth()
      setToken(null)
      setUser(null)
    }

    window.addEventListener('sabiodoc:unauthorized', handleUnauthorized)
    return () => {
      window.removeEventListener('sabiodoc:unauthorized', handleUnauthorized)
    }
  }, [])

  // Heartbeat de presencia: mantiene al medico como "Disponible" mientras usa la app.
  useEffect(() => {
    if (!token || !user?.doctor_status) return
    const ping = () => {
      heartbeatPresence().catch(() => {
        /* silencioso: la presencia es best-effort */
      })
    }
    ping()
    const intervalId = window.setInterval(ping, 60000)
    return () => window.clearInterval(intervalId)
  }, [token, user?.doctor_status])

  const login = (newToken: string, userData: User, remember = false) => {
    setStoredAuth(newToken, userData, remember)
    setToken(newToken)
    setUser(userData)
  }

  const logout = () => {
    clearStoredAuth()
    setToken(null)
    setUser(null)
  }

  const refreshUser = async () => {
    const storedToken = getStoredToken()
    if (!storedToken) {
      setToken(null)
      setUser(null)
      return null
    }

    try {
      const userData = await getMe()
      setStoredUser(userData)
      setToken(storedToken)
      setUser(userData)
      return userData
    } catch {
      clearStoredAuth()
      setToken(null)
      setUser(null)
      return null
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      refreshUser,
      isAuthenticated: !!token && !!user,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
