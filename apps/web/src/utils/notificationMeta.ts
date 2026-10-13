import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  BellRing,
  CalendarDays,
  CalendarX,
  CircleDollarSign,
  FileText,
  LifeBuoy,
  ShieldCheck,
  Star,
  Video,
} from 'lucide-react'

export type NotificationCategory =
  | 'appointments'
  | 'reminders'
  | 'cancellations'
  | 'video'
  | 'credits'
  | 'reviews'
  | 'profile'
  | 'files'
  | 'support'
  | 'system'

export interface NotificationCategoryConfig {
  id: NotificationCategory
  label: string
  icon: LucideIcon
  /** Contenedor del icono (fondo + color). */
  chipClass: string
  /** Etiqueta de categoría. */
  badgeClass: string
  /** Barra de acento lateral. */
  accentClass: string
  /** Toast al recibir la notificación en vivo. */
  toastClass: string
}

/**
 * Categorías de notificación, cada una con su color e icono.
 * Se usa color + icono + etiqueta (nunca solo color) para que sigan siendo
 * identificables sin depender de la percepción del color.
 */
export const NOTIFICATION_CATEGORIES: NotificationCategoryConfig[] = [
  {
    id: 'appointments',
    label: 'Citas',
    icon: CalendarDays,
    chipClass: 'bg-blue-100 text-blue-700',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
    accentClass: 'bg-blue-400',
    toastClass: 'border-blue-200 bg-blue-50 text-blue-900',
  },
  {
    id: 'reminders',
    label: 'Recordatorios',
    icon: BellRing,
    chipClass: 'bg-sky-100 text-sky-700',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    accentClass: 'bg-sky-400',
    toastClass: 'border-sky-200 bg-sky-50 text-sky-900',
  },
  {
    id: 'cancellations',
    label: 'Cancelaciones',
    icon: CalendarX,
    chipClass: 'bg-red-100 text-red-700',
    badgeClass: 'border-red-200 bg-red-50 text-red-700',
    accentClass: 'bg-red-400',
    toastClass: 'border-red-200 bg-red-50 text-red-900',
  },
  {
    id: 'video',
    label: 'Videollamada',
    icon: Video,
    chipClass: 'bg-emerald-100 text-emerald-700',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    accentClass: 'bg-emerald-400',
    toastClass: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  {
    id: 'credits',
    label: 'Créditos',
    icon: CircleDollarSign,
    chipClass: 'bg-amber-100 text-amber-700',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    accentClass: 'bg-amber-400',
    toastClass: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  {
    id: 'reviews',
    label: 'Reseñas',
    icon: Star,
    chipClass: 'bg-orange-100 text-orange-700',
    badgeClass: 'border-orange-200 bg-orange-50 text-orange-700',
    accentClass: 'bg-orange-400',
    toastClass: 'border-orange-200 bg-orange-50 text-orange-900',
  },
  {
    id: 'profile',
    label: 'Perfil',
    icon: BadgeCheck,
    chipClass: 'bg-violet-100 text-violet-700',
    badgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
    accentClass: 'bg-violet-400',
    toastClass: 'border-violet-200 bg-violet-50 text-violet-900',
  },
  {
    id: 'files',
    label: 'Archivos',
    icon: FileText,
    chipClass: 'bg-cyan-100 text-cyan-700',
    badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    accentClass: 'bg-cyan-400',
    toastClass: 'border-cyan-200 bg-cyan-50 text-cyan-900',
  },
  {
    id: 'support',
    label: 'Soporte',
    icon: LifeBuoy,
    chipClass: 'bg-teal-100 text-teal-700',
    badgeClass: 'border-teal-200 bg-teal-50 text-teal-700',
    accentClass: 'bg-teal-400',
    toastClass: 'border-teal-200 bg-teal-50 text-teal-900',
  },
  {
    id: 'system',
    label: 'Sistema',
    icon: ShieldCheck,
    chipClass: 'bg-slate-100 text-slate-700',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
    accentClass: 'bg-slate-400',
    toastClass: 'border-slate-200 bg-slate-50 text-slate-900',
  },
]

const CATEGORY_BY_ID = Object.fromEntries(
  NOTIFICATION_CATEGORIES.map((category) => [category.id, category]),
) as Record<NotificationCategory, NotificationCategoryConfig>

/** Tipos conocidos que no se pueden inferir solo por el prefijo. */
const CATEGORY_BY_TYPE: Record<string, NotificationCategory> = {
  appointment_booked: 'appointments',
  appointment_scheduled: 'appointments',
  appointment_rescheduled: 'appointments',
  appointment_completed: 'appointments',
  appointment_reminder_day: 'reminders',
  appointment_reminder_hour: 'reminders',
  appointment_review_reminder: 'reminders',
  appointment_cancelled: 'cancellations',
  appointment_no_show: 'cancellations',
  appointment_review: 'reviews',
  consultation_review: 'reviews',
  appointment_file_received: 'files',
  file_shared: 'files',
  doctor_note_updated: 'files',
  video_session_no_credits: 'credits',
  withdrawal: 'credits',
  video_consultation_completed: 'video',
  doctor_application_reviewed: 'profile',
  patient_profile_change_request: 'profile',
  patient_profile_change_resolved: 'profile',
  doctor_profile: 'profile',
  audit: 'system',
  test: 'system',
  specialty: 'system',
  support_ticket_created: 'support',
  support_ticket_reply: 'support',
  support_ticket_resolved: 'support',
}

/**
 * Resuelve la categoría de una notificación a partir de su `type`.
 * Prioriza el mapa explícito y cae a heurísticas por prefijo para tipos nuevos.
 */
export function resolveNotificationCategory(type: string): NotificationCategory {
  const direct = CATEGORY_BY_TYPE[type]
  if (direct) return direct

  if (type.startsWith('appointment_reminder')) return 'reminders'
  if (type.startsWith('appointment_')) return 'appointments'
  if (
    type.startsWith('patient_profile') ||
    type.startsWith('doctor_application') ||
    type.startsWith('doctor_profile')
  ) {
    return 'profile'
  }
  if (type.includes('review')) return 'reviews'
  if (type.includes('credit') || type.includes('wallet') || type.includes('withdraw')) return 'credits'
  if (type.startsWith('video')) return 'video'
  if (type.startsWith('support_ticket')) return 'support'
  if (type.includes('file') || type.includes('note')) return 'files'
  return 'system'
}

/** Devuelve el color, icono y etiqueta de una notificación según su tipo. */
export function getNotificationMeta(type: string): NotificationCategoryConfig {
  return CATEGORY_BY_ID[resolveNotificationCategory(type)]
}
