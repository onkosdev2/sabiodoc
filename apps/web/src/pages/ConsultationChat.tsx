import { useCallback, useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  Send, 
  ArrowLeft, 
  Bot, 
  User, 
  Loader2, 
  FileText,
  Video,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { 
  getConsultation, 
  getChatHistory, 
  startChat, 
  sendChatMessage, 
  generateSummary,
  Consultation,
  ChatMessage 
} from '../api/consultations'
import { useAuth } from '../context/AuthContext'
import StructuredIntakeCard from '../components/StructuredIntakeCard'

export default function ConsultationChat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [summaryGenerated, setSummaryGenerated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadConsultation = useCallback(async () => {
    if (!id) return
    
    setLoading(true)
    setError(null)
    
    try {
      const consultationData = await getConsultation(parseInt(id))
      setConsultation(consultationData)
      
      if (consultationData.summary) {
        setSummaryGenerated(true)
      }
      
      // Cargar historial de chat
      const historyData = await getChatHistory(parseInt(id))
      
      if (historyData.messages.length === 0) {
        // Iniciar chat si no hay mensajes
        const welcomeMessage = await startChat(parseInt(id))
        setMessages([welcomeMessage])
      } else {
        setMessages(historyData.messages)
      }
    } catch (err: any) {
      console.error('Error loading consultation:', err)
      setError(err.response?.data?.detail || 'Error al cargar la consulta')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    if (id) {
      loadConsultation()
    }
  }, [id, user, navigate, loadConsultation])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inputMessage.trim() || !id || sending) return
    
    const messageText = inputMessage.trim()
    setInputMessage('')
    setSending(true)
    
    // Agregar mensaje del usuario optimistamente
    const tempUserMessage: ChatMessage = {
      id: Date.now(),
      consultation_id: parseInt(id),
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMessage])
    
    try {
      const response = await sendChatMessage(parseInt(id), messageText)
      
      // Reemplazar mensaje temporal con el real y agregar respuesta del asistente
      setMessages(prev => [
        ...prev.slice(0, -1),
        response.user_message,
        response.assistant_message
      ])
    } catch (err: any) {
      console.error('Error sending message:', err)
      // Remover mensaje temporal en caso de error
      setMessages(prev => prev.slice(0, -1))
      setError('Error al enviar el mensaje. Intenta de nuevo.')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleGenerateSummary = async () => {
    if (!id || generatingSummary) return
    
    setGeneratingSummary(true)
    
    try {
      const response = await generateSummary(parseInt(id))
      setSummaryGenerated(true)
      setConsultation((current) =>
        current
          ? {
              ...current,
              summary: response.summary,
              intake: response.intake,
            }
          : current
      )
      
      // Agregar mensaje del sistema indicando que se generó el resumen
      const summaryMessage: ChatMessage = {
        id: Date.now(),
        consultation_id: parseInt(id),
        role: 'assistant',
        content: '✅ He generado un resumen de nuestra conversación para el médico. Cuando tengas tu videoconsulta, el especialista podrá revisar esta información para entender mejor tu caso. ¿Estás listo/a para agendar tu cita?',
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, summaryMessage])
    } catch (err: any) {
      console.error('Error generating summary:', err)
      setError(err.response?.data?.detail || 'Error al generar el resumen')
    } finally {
      setGeneratingSummary(false)
    }
  }

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando consulta...</p>
        </div>
      </div>
    )
  }

  if (error && !consultation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/me/consultations"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a mis consultas
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/me/consultations')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="font-semibold text-gray-900">
                Asistente de {consultation?.specialty?.name || 'Especialidad'}
              </h1>
              <p className="text-sm text-gray-500">Pre-consulta con IA</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {messages.length >= 4 && !summaryGenerated && (
              <button
                onClick={handleGenerateSummary}
                disabled={generatingSummary}
                className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {generatingSummary ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generar resumen
              </button>
            )}
            
            {summaryGenerated && (
              <span className="inline-flex items-center px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg">
                <CheckCircle className="h-4 w-4 mr-2" />
                Resumen listo
              </span>
            )}
            
            <button
              onClick={() => navigate(`/consultation/${consultation?.id}/book`)}
              className="inline-flex items-center px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Video className="h-4 w-4 mr-2" />
              Agendar videoconsulta
            </button>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-800">
              <strong>Importante:</strong> Este asistente virtual te ayuda a preparar tu consulta médica. 
              No proporciona diagnósticos ni tratamientos. La información recopilada será útil para el 
              especialista durante tu videoconsulta.
            </p>
          </div>

          {consultation?.intake && (
            <StructuredIntakeCard intake={consultation.intake} title="Ficha estructurada para la videoconsulta" />
          )}

          {/* Messages */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex items-start space-x-3 max-w-[80%] ${
                  message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-primary-100 text-primary-600'
                      : 'bg-teal-100 text-teal-600'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-primary-200' : 'text-gray-400'
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Error Toast */}
      {error && consultation && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 text-white/80 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Area */}
      <footer className="bg-white border-t border-gray-200 p-4 sticky bottom-0">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Escribe tu mensaje..."
              disabled={sending}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || sending}
              className="p-3 bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </form>
      </footer>
    </div>
  )
}
