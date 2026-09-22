import { useCallback, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Bot, User, Loader2, FileText, AlertCircle, CheckCircle, X, ArrowLeft, Trash2 } from 'lucide-react'

import {
  getConsultation,
  getChatHistory,
  startChat,
  sendChatMessage,
  generateSummary,
  closeConsultation,
  deleteConsultation,
  Consultation,
  ChatMessage,
} from '../api/consultations'
import StructuredIntakeCard from './StructuredIntakeCard'
import RichText from './RichText'
import Alert from './ui/Alert'
import Badge from './ui/Badge'
import Button from './ui/Button'
import ConfirmDialog from './ConfirmDialog'

interface ConsultationChatViewProps {
  consultationId: number
  variant?: 'page' | 'panel'
  onClose?: () => void
}

export default function ConsultationChatView({
  consultationId,
  variant = 'page',
  onClose,
}: ConsultationChatViewProps) {
  const navigate = useNavigate()
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [closing, setClosing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'summary' | 'close' | null>(null)
  const [summaryGenerated, setSummaryGenerated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Scroll interno del listado, sin mover la página completa.
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, sending])

  const loadConsultation = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const consultationData = await getConsultation(consultationId)
      setConsultation(consultationData)
      if (consultationData.summary) {
        setSummaryGenerated(true)
      }

      const historyData = await getChatHistory(consultationId)
      if (historyData.messages.length === 0) {
        const welcomeMessage = await startChat(consultationId)
        setMessages([welcomeMessage])
      } else {
        setMessages(historyData.messages)
      }
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { detail?: string } } }
      console.error('Error loading consultation:', err)
      setError(requestError.response?.data?.detail || 'Error al cargar la consulta')
    } finally {
      setLoading(false)
    }
  }, [consultationId])

  useEffect(() => {
    loadConsultation()
  }, [loadConsultation])

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault()
    const messageText = inputMessage.trim()
    if (!messageText || sending) return

    const tempId = -Date.now()
    const tempUserMessage: ChatMessage = {
      id: tempId,
      consultation_id: consultationId,
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
    }

    setInputMessage('')
    setSending(true)
    setError(null)
    setMessages((prev) => [...prev, tempUserMessage])

    try {
      const response = await sendChatMessage(consultationId, messageText)
      setMessages((prev) => [
        ...prev.filter((message) => message.id !== tempId),
        response.user_message,
        response.assistant_message,
      ])
      // Al enviar el primer mensaje la consulta deja de ser un borrador.
      setConsultation((current) =>
        current && current.status === 'created' ? { ...current, status: 'active' } : current,
      )

      // Si el paciente confirmó el resumen en el chat, el backend lo generó y
      // cerró la pre-consulta: reflejamos ese estado para ocultar el input.
      if (response.summary_generated) {
        setSummaryGenerated(true)
        setConsultation((current) =>
          current ? { ...current, status: 'closed', closed_at: new Date().toISOString() } : current,
        )
      }
    } catch (err: unknown) {
      console.error('Error sending message:', err)
      setMessages((prev) => prev.filter((message) => message.id !== tempId))
      setError('Error al enviar el mensaje. Intenta de nuevo.')
    } finally {
      setSending(false)
      // Mantiene el cursor en el campo para seguir escribiendo.
      inputRef.current?.focus()
    }
  }

  const handleGenerateSummary = async () => {
    if (generatingSummary) return
    setGeneratingSummary(true)
    try {
      const response = await generateSummary(consultationId)
      setSummaryGenerated(true)
      // El backend finaliza la consulta al generar el resumen.
      setConsultation((current) =>
        current
          ? { ...current, summary: response.summary, intake: response.intake, status: 'closed' }
          : current,
      )
      setMessages((prev) => [
        ...prev,
        {
          id: -Date.now(),
          consultation_id: consultationId,
          role: 'assistant',
          content:
            '✅ He generado un resumen de nuestra conversación para el médico. Ya puedes agendar tu videoconsulta con el especialista desde la página de la especialidad.',
          created_at: new Date().toISOString(),
        },
      ])
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { detail?: string } } }
      setError(requestError.response?.data?.detail || 'Error al generar el resumen')
    } finally {
      setGeneratingSummary(false)
      setConfirmAction(null)
    }
  }

  const handleClose = async () => {
    if (closing) return
    setClosing(true)
    setError(null)
    try {
      const updated = await closeConsultation(consultationId)
      setConsultation(updated)
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { detail?: string } } }
      setError(requestError.response?.data?.detail || 'No se pudo finalizar la consulta')
    } finally {
      setClosing(false)
      setConfirmAction(null)
    }
  }

  // Un borrador sin mensajes del usuario puede cancelarse y borrarse por completo:
  // así un clic equivocado no deja registro clínico alguno.
  const handleCancel = async () => {
    if (cancelling) return
    setCancelling(true)
    setError(null)
    try {
      await deleteConsultation(consultationId)
      setConfirmAction(null)
      if (onClose) {
        onClose()
      } else {
        navigate(-1)
      }
    } catch (err: unknown) {
      const requestError = err as { response?: { data?: { detail?: string } } }
      setError(
        requestError.response?.data?.detail ||
          'No se pudo cancelar la consulta. Intenta de nuevo.',
      )
      setConfirmAction(null)
    } finally {
      setCancelling(false)
    }
  }

  const isClosed = consultation?.status === 'closed'
  const hasUserMessages = messages.some((message) => message.role === 'user')
  const canCancel = !isClosed && !hasUserMessages

  // Configuración de los diálogos de confirmación de acciones destructivas/irreversibles.
  const confirmConfig = {
    cancel: {
      tone: 'danger' as const,
      title: '¿Cancelar esta consulta?',
      description:
        'Se eliminará por completo y no quedará ningún registro. Úsalo si la iniciaste por error o no corresponde a tu caso.',
      confirmLabel: 'Sí, cancelar',
      busy: cancelling,
      onConfirm: handleCancel,
    },
    summary: {
      tone: 'default' as const,
      title: '¿Generar el resumen?',
      description:
        'La IA resumirá la conversación para el médico y la consulta se dará por finalizada. Después podrás agendar tu videoconsulta.',
      confirmLabel: 'Generar resumen',
      busy: generatingSummary,
      onConfirm: handleGenerateSummary,
    },
    close: {
      tone: 'default' as const,
      title: '¿Finalizar esta consulta?',
      description:
        'Se guardará en tu historial y no podrás seguir conversando con la IA en esta consulta. Podrás iniciar una nueva cuando quieras.',
      confirmLabel: 'Finalizar',
      busy: closing,
      onConfirm: handleClose,
    },
  }
  const activeConfirm = confirmAction ? confirmConfig[confirmAction] : null

  const heightClass = 'h-full min-h-0'

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 ${heightClass}`}>
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary-600" />
          <p className="mt-3 text-slate-600">Cargando consulta...</p>
        </div>
      </div>
    )
  }

  if (!consultation) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 p-6 ${heightClass}`}>
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-red-500" />
          <p className="text-slate-700">{error || 'No se pudo cargar la consulta'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col overflow-hidden bg-slate-50 ${heightClass}`}>
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {variant === 'page' && (
            <button type="button"
              onClick={() => navigate(-1)}
              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100"
              aria-label="Volver a la página anterior"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-slate-900">
              Asistente de {consultation?.specialty?.name || 'Especialidad'}
            </h1>
            <p className="text-xs text-slate-500">Pre-consulta con IA</p>
          </div>
        </div>

        <div className="flex flex-none items-center gap-2">
          {canCancel && (
            <button
              type="button"
              onClick={() => setConfirmAction('cancel')}
              disabled={cancelling}
              aria-label="Cancelar consulta"
              title="Cancelar consulta"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Cancelar</span>
            </button>
          )}

          {!isClosed && messages.length >= 4 && !summaryGenerated && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmAction('summary')}
              loading={generatingSummary}
              aria-label="Generar resumen"
              leftIcon={<FileText className="h-4 w-4" />}
            >
              <span className="hidden sm:inline">Generar resumen</span>
            </Button>
          )}

          {!isClosed && messages.length >= 2 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmAction('close')}
              loading={closing}
              aria-label="Finalizar consulta"
              leftIcon={<CheckCircle className="h-4 w-4" />}
            >
              <span className="hidden sm:inline">Finalizar</span>
            </Button>
          )}

          {isClosed && (
            <Badge tone="success" icon={<CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />}>
              <span className="hidden sm:inline">Consulta finalizada</span>
            </Badge>
          )}

          {onClose && (
            <button type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Cerrar chat"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div
        className="min-h-0 flex-1 overflow-y-auto p-4"
        role="log"
        aria-live="polite"
        aria-label="Conversación con el asistente"
      >
        <div className="mx-auto max-w-3xl space-y-4">
          <Alert tone="warning" title="Importante">
            Este asistente virtual te ayuda a preparar tu consulta médica. No proporciona diagnósticos ni
            tratamientos. La información recopilada será útil para el especialista durante tu videoconsulta.
          </Alert>

          {consultation?.intake && (
            <StructuredIntakeCard intake={consultation.intake} title="Ficha estructurada para la videoconsulta" />
          )}

          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`flex max-w-[85%] items-start gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${
                    message.role === 'user' ? 'bg-primary-100 text-primary-600' : 'bg-teal-100 text-teal-600'
                  }`}
                >
                  {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                <div
                  className={`min-w-0 rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  {message.role === 'user' ? (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  ) : (
                    <RichText text={message.content} className="break-words" />
                  )}
                  <p
                    className={`mt-1 text-xs ${
                      message.role === 'user' ? 'text-primary-200' : 'text-slate-500'
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start" role="status" aria-label="El asistente está escribiendo">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-teal-100 text-teal-600">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-2">
          <Alert
            tone="danger"
            action={
              <Button variant="ghost" size="sm" onClick={() => setError(null)}>
                Descartar
              </Button>
            }
          >
            {error}
          </Alert>
        </div>
      )}

      {/* Input */}
      {isClosed ? (
        <div className="border-t border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
          Esta consulta finalizó. Puedes iniciar una nueva desde la página de la especialidad.
        </div>
      ) : (
        <footer className="border-t border-slate-200 bg-white p-4">
          <form onSubmit={handleSendMessage} className="mx-auto max-w-3xl">
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                aria-label="Escribe tu mensaje para el asistente"
                value={inputMessage}
                onChange={(event) => setInputMessage(event.target.value)}
                placeholder="Escribe tu mensaje..."
                autoFocus={variant === 'panel'}
                className="flex-1 rounded-full border border-slate-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                aria-label="Enviar mensaje"
                disabled={!inputMessage.trim() || sending}
                className="rounded-full bg-primary-600 p-3 text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </form>
        </footer>
      )}

      <ConfirmDialog
        open={activeConfirm !== null}
        tone={activeConfirm?.tone}
        title={activeConfirm?.title ?? ''}
        description={activeConfirm?.description}
        confirmLabel={activeConfirm?.confirmLabel}
        cancelLabel="Volver"
        busy={activeConfirm?.busy}
        onConfirm={() => activeConfirm?.onConfirm()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
