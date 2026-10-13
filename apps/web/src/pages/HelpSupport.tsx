import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, HelpCircle, LifeBuoy, MessageSquarePlus, Plus, RefreshCcw } from 'lucide-react'

import {
  SupportAttachment,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketDetail,
  createSupportTicket,
  getMySupportTickets,
  getSupportTicket,
} from '../api/support'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import {
  SUPPORT_TICKET_CATEGORY_LABELS,
  SUPPORT_TICKET_PRIORITY_TONES,
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
  SUPPORT_TICKET_STATUS_TONES,
} from '../utils/statusLabels'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Input, Select, Textarea } from '../components/ui/Field'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import SupportTicketThread from '../components/SupportTicketThread'
import TicketAttachmentPicker from '../components/TicketAttachmentPicker'

const CATEGORY_OPTIONS: SupportTicketCategory[] = ['account', 'payments', 'video', 'app_error', 'other']

const FAQ: { category: string; items: { q: string; a: string }[] }[] = [
  {
    category: 'Cuenta',
    items: [
      {
        q: '¿Cómo cambio mi contraseña?',
        a: 'Ve a Perfil → Seguridad. Al cambiarla, cerramos tus otras sesiones y te enviamos un correo de confirmación.',
      },
      {
        q: 'No puedo iniciar sesión, ¿qué hago?',
        a: 'Usa "Recuperar contraseña" en la pantalla de inicio de sesión. Si tu correo no está verificado, revisa tu bandeja (y spam) o reenvía el enlace.',
      },
    ],
  },
  {
    category: 'Pagos y créditos',
    items: [
      {
        q: '¿Qué son los créditos?',
        a: 'Es tu saldo para pagar videoconsultas. 1 crédito = 1 USD. Puedes recargar desde Perfil → Créditos.',
      },
      {
        q: '¿Cómo funciona el cobro de una cita?',
        a: 'Se retiene el monto del tiempo reservado y, al terminar, se cobra solo el tiempo real. Lo no usado se devuelve a tu saldo.',
      },
    ],
  },
  {
    category: 'Videoconsulta',
    items: [
      {
        q: '¿Qué necesito para la videollamada?',
        a: 'Un navegador actualizado con permiso de cámara y micrófono. Antes de entrar puedes comprobar tus dispositivos.',
      },
      {
        q: 'No puedo entrar a la sala',
        a: 'Verifica la cámara/micrófono, que la cita esté dentro de su horario y tu conexión. Si persiste, envía un ticket con categoría "Videoconsulta"; adjuntamos automáticamente tu último error.',
      },
    ],
  },
  {
    category: 'IA',
    items: [
      {
        q: '¿La IA reemplaza al médico?',
        a: 'No. La orientación con IA es informativa y no sustituye una consulta médica profesional.',
      },
    ],
  },
]

export default function HelpSupport() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SupportTicketDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [faqOpen, setFaqOpen] = useState(false)

  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<SupportTicketCategory>('other')
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<SupportAttachment[]>([])
  const [submitting, setSubmitting] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getMySupportTickets()
      setTickets(response.tickets)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar tus tickets.'))
    } finally {
      setLoading(false)
    }
  }, [])

  const openTicket = useCallback(
    async (ticketId: number) => {
      setDetailLoading(true)
      try {
        setSelected(await getSupportTicket(ticketId))
      } catch (err: unknown) {
        toast.error(getApiErrorMessage(err, 'No se pudo abrir el ticket.'))
      } finally {
        setDetailLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    loadList()
  }, [loadList])

  // Abre un ticket indicado por URL (?ticket=123), p. ej. desde una notificación.
  useEffect(() => {
    const raw = searchParams.get('ticket')
    if (!raw) {
      setSelected(null)
      return
    }
    const ticketId = Number(raw)
    if (Number.isFinite(ticketId)) {
      openTicket(ticketId)
    }
  }, [searchParams, openTicket])

  const startNewTicket = () => {
    setSelected(null)
    setSearchParams({})
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (subject.trim().length < 3) {
      toast.error('Escribe un asunto.')
      return
    }
    if (message.trim().length < 10) {
      toast.error('Describe tu caso con un poco más de detalle.')
      return
    }
    setSubmitting(true)
    try {
      const created = await createSupportTicket({
        subject: subject.trim(),
        category,
        message: message.trim(),
        attachment_ids: attachments.map((item) => item.id),
        context: { url: window.location.href, user_agent: navigator.userAgent },
      })
      setSubject('')
      setCategory('other')
      setMessage('')
      setAttachments([])
      await loadList()
      setSelected(created)
      setSearchParams({ ticket: String(created.id) })
      toast.success(`Ticket ${created.reference || ''} creado. Te responderemos pronto.`)
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'No se pudo crear el ticket.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LifeBuoy}
        title="Ayuda y soporte"
        description="Envíanos un ticket con lo que te ocurre o revisa tus solicitudes. Incluye capturas si puedes: ayuda a resolverlo más rápido."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={loadList}
              disabled={loading}
              leftIcon={<RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
            >
              Actualizar
            </Button>
            {selected && (
              <Button onClick={startNewTicket} leftIcon={<Plus className="h-4 w-4" />}>
                Nuevo ticket
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        {/* Columna principal: conversación o formulario */}
        {selected || detailLoading ? (
          <Card>
            {detailLoading || !selected ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {selected.reference} · {selected.subject}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {SUPPORT_TICKET_CATEGORY_LABELS[selected.category]} · Prioridad{' '}
                      {SUPPORT_TICKET_PRIORITY_LABELS[selected.priority]}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={SUPPORT_TICKET_PRIORITY_TONES[selected.priority] ?? 'neutral'}>
                      {SUPPORT_TICKET_PRIORITY_LABELS[selected.priority] ?? selected.priority}
                    </Badge>
                    <Badge tone={SUPPORT_TICKET_STATUS_TONES[selected.status] ?? 'neutral'}>
                      {SUPPORT_TICKET_STATUS_LABELS[selected.status] ?? selected.status}
                    </Badge>
                  </div>
                </div>
                <div className="mt-4">
                  <SupportTicketThread
                    ticket={selected}
                    onReplied={() => {
                      loadList()
                      openTicket(selected.id)
                    }}
                    replyHint="Te avisaremos cuando soporte responda."
                  />
                </div>
              </>
            )}
          </Card>
        ) : (
          <Card>
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5 text-primary-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-slate-900">Enviar un ticket</h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Cuéntanos qué pasó con el mayor detalle posible. Revisa las preguntas frecuentes por si tu caso ya está resuelto.
            </p>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <Input
                label="Asunto"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Resumen breve de lo que ocurre"
                maxLength={255}
                required
              />
              <Select
                label="Categoría"
                value={category}
                onChange={(event) => setCategory(event.target.value as SupportTicketCategory)}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {SUPPORT_TICKET_CATEGORY_LABELS[option]}
                  </option>
                ))}
              </Select>
              <Textarea
                label="Descripción"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Cuéntanos qué pasó, cuándo y qué mensaje de error viste."
                className="min-h-32"
                maxLength={5000}
                required
              />
              <TicketAttachmentPicker attachments={attachments} onChange={setAttachments} />
              <Alert tone="info">
                No compartas contraseñas ni datos sensibles. Adjuntamos automáticamente tu último error
                registrado para ayudarnos a diagnosticar.
              </Alert>
              <Button
                type="submit"
                loading={submitting}
                disabled={!subject.trim() || !message.trim()}
                className="w-full"
              >
                Enviar ticket
              </Button>
            </form>
          </Card>
        )}

        {/* Columna lateral: mis tickets */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Mis tickets</h2>
          {loading ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : error ? (
            <div className="mt-4">
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : tickets.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Todavía no has enviado tickets.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSearchParams({ ticket: String(ticket.id) })}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selected?.id === ticket.id
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">
                      {ticket.reference} · {ticket.subject}
                    </span>
                    <Badge tone={SUPPORT_TICKET_STATUS_TONES[ticket.status] ?? 'neutral'}>
                      {SUPPORT_TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]} ·{' '}
                    {new Date(ticket.updated_at || ticket.created_at || '').toLocaleString('es-ES')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* FAQ al final, plegada */}
      <Card>
        <button
          type="button"
          onClick={() => setFaqOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={faqOpen}
        >
          <span className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary-600" aria-hidden="true" />
            <span className="text-lg font-semibold text-slate-900">Preguntas frecuentes</span>
          </span>
          <ChevronDown
            className={`h-5 w-5 text-slate-500 transition-transform ${faqOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {faqOpen && (
          <div className="mt-4 space-y-4">
            {FAQ.map((group) => (
              <div key={group.category}>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{group.category}</p>
                <div className="mt-2 space-y-2">
                  {group.items.map((item) => (
                    <details key={item.q} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-slate-800">
                        {item.q}
                      </summary>
                      <p className="mt-2 text-sm text-slate-600">{item.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
