import { useEffect } from 'react'
import { MessageCircle } from 'lucide-react'

import { useConsultationChat } from '../context/ConsultationChatContext'
import ConsultationChatView from './ConsultationChatView'

/**
 * Panel lateral derecho con el asistente de pre-consulta.
 *
 * No bloquea el resto de la página (sin backdrop a pantalla completa), para que
 * el usuario pueda seguir navegando mientras espera a un médico.
 */
export default function ConsultationChatPanel() {
  const { isOpen, consultationId, openChat, closeChat } = useConsultationChat()

  // Reserva espacio a la derecha para que el panel no tape la página.
  useEffect(() => {
    document.body.classList.toggle('chat-panel-open', isOpen)
    return () => document.body.classList.remove('chat-panel-open')
  }, [isOpen])

  if (consultationId == null) {
    return null
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => openChat(consultationId)}
        className="fixed bottom-6 right-6 z-[55] inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        <MessageCircle className="h-5 w-5" />
        Continuar consulta IA
      </button>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex justify-end">
      <aside className="pointer-events-auto h-full w-full max-w-xl border-l border-gray-200 bg-white shadow-2xl">
        <ConsultationChatView consultationId={consultationId} variant="panel" onClose={closeChat} />
      </aside>
    </div>
  )
}
