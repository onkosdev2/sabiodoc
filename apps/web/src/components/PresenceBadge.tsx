import type { DoctorPresence } from '../api/doctors'
import { formatRelativeTime } from '../utils/relativeTime'

const STYLES: Record<string, { dot: string; pill: string }> = {
  online: { dot: 'bg-green-500', pill: 'border-green-200 bg-green-50 text-green-700' },
  busy: { dot: 'bg-amber-500', pill: 'border-amber-200 bg-amber-50 text-amber-700' },
  offline: { dot: 'bg-slate-400', pill: 'border-slate-200 bg-slate-50 text-slate-600' },
}

interface PresenceBadgeProps {
  presence: DoctorPresence
  className?: string
}

/** Badge de disponibilidad del médico, consistente en todas las pantallas. */
export default function PresenceBadge({ presence, className = '' }: PresenceBadgeProps) {
  const style = STYLES[presence.status] || STYLES.offline
  const baseLabel = presence.status_message || presence.status
  const showLastSeen = presence.status === 'offline' && presence.last_seen_at
  const label = showLastSeen ? `${baseLabel} · ${formatRelativeTime(presence.last_seen_at)}` : baseLabel
  const title = presence.last_seen_at
    ? `Última actividad: ${new Date(presence.last_seen_at).toLocaleString('es-ES')}`
    : undefined

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${style.pill} ${className}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
      {label}
    </span>
  )
}
