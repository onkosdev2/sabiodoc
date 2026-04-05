import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, getMe } from '../api/auth'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  refreshUser: () => Promise<User | null>
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token')
      if (storedToken) {
        try {
          const userData = await getMe()
          setUser(userData)
          setToken(storedToken)
        } catch {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
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
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setToken(null)
      setUser(null)
    }

    window.addEventListener('sabiodoc:unauthorized', handleUnauthorized)
    return () => {
      window.removeEventListener('sabiodoc:unauthorized', handleUnauthorized)
    }
  }, [])

  const login = (newToken: string, userData: User) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(userData))
    setToken(newToken)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  const refreshUser = async () => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      setToken(null)
      setUser(null)
      return null
    }

    try {
      const userData = await getMe()
      localStorage.setItem('user', JSON.stringify(userData))
      setToken(storedToken)
      setUser(userData)
      return userData
    } catch {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
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
