import { useState } from 'react'
import { CheckCircle2, FileText, Send } from 'lucide-react'

import {
  SupportAttachment,
  SupportTicketDetail,
  replySupportTicket,
} from '../api/support'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import Button from './ui/Button'
import { Textarea } from './ui/Field'
import TicketAttachmentPicker from './TicketAttachmentPicker'

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : ''

function AttachmentLink({ attachment }: { attachment: SupportAttachment }) {
  return (
    <a
      href={attachment.secure_url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-slate-400"
    >
      <FileText className="h-3.5 w-3.5 text-slate-400" />
      <span className="max-w-[180px] truncate">{attachment.original_name}</span>
    </a>
  )
}

interface SupportTicketThreadProps {
  ticket: SupportTicketDetail
  onReplied: () => void
  /** Texto de ayuda bajo la caja de respuesta. */
  replyHint?: string
}

/** Hilo de mensajes de un ticket + caja de respuesta con adjuntos. */
export default function SupportTicketThread({ ticket, onReplied, replyHint }: SupportTicketThreadProps) {
  const toast = useToast()
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<SupportAttachment[]>([])
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!body.trim() && attachments.length === 0) return
    setSending(true)
    try {
      await replySupportTicket(ticket.id, {
        message: body.trim() || '(Adjunto)',
        attachment_ids: attachments.map((item) => item.id),
      })
      setBody('')
      setAttachments([])
      onReplied()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo enviar la respuesta.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {ticket.messages.map((message) => {
          const isSupport = message.author_role === 'support'
          return (
            <div key={message.id} className={`flex ${isSupport ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[85%] rounded-2xl border px-4 py-3 text-sm ${
                  isSupport
                    ? 'border-amber-200 bg-amber-50 text-slate-800'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    {isSupport ? message.author_name || 'Soporte SabioDoc' : 'Tú'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {formatDateTime(message.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words">{message.body}</p>
                {message.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.attachments.map((attachment) => (
                      <AttachmentLink key={attachment.id} attachment={attachment} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {ticket.status === 'closed' ? (
        <p className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
          <CheckCircle2 className="h-4 w-4" /> Este ticket está cerrado. Si necesitas algo más, crea uno nuevo.
        </p>
      ) : (
        <>
          {ticket.status === 'resolved' && (
            <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> Soporte marcó este ticket como resuelto. Si el problema
              continúa, responde y se reabrirá.
            </p>
          )}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <Textarea
            label="Escribe una respuesta"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Describe lo que ocurre o responde al equipo de soporte..."
            className="min-h-24 bg-white"
            maxLength={5000}
          />

          <div className="mt-2">
            <TicketAttachmentPicker attachments={attachments} onChange={setAttachments} />
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              onClick={handleSend}
              loading={sending}
              disabled={!body.trim() && attachments.length === 0}
              leftIcon={<Send className="h-4 w-4" />}
            >
              Enviar
            </Button>
          </div>
          {replyHint && <p className="mt-2 text-xs text-slate-500">{replyHint}</p>}
          </div>
        </>
      )}
    </div>
  )
}
