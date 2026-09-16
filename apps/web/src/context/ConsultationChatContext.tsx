import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'

import { useAuth } from './AuthContext'

interface ConsultationChatContextType {
  isOpen: boolean
  consultationId: number | null
  openChat: (consultationId: number) => void
  closeChat: () => void
}

const ConsultationChatContext = createContext<ConsultationChatContextType | undefined>(undefined)

export function ConsultationChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [consultationId, setConsultationId] = useState<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  // Al iniciar o cerrar sesión reiniciamos el asistente para no arrastrar la
  // consulta de otra cuenta/sesión (p. ej. el botón "Continuar consulta IA").
  useEffect(() => {
    setConsultationId(null)
    setIsOpen(false)
  }, [user?.id])

  const openChat = useCallback((id: number) => {
    setConsultationId(id)
    setIsOpen(true)
  }, [])

  const closeChat = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <ConsultationChatContext.Provider value={{ isOpen, consultationId, openChat, closeChat }}>
      {children}
    </ConsultationChatContext.Provider>
  )
}

export function useConsultationChat() {
  const context = useContext(ConsultationChatContext)
  if (context === undefined) {
    throw new Error('useConsultationChat must be used within a ConsultationChatProvider')
  }
  return context
}
