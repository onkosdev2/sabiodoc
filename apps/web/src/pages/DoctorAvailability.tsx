import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, Clock3, Copy, Plus, RotateCcw, Trash2 } from 'lucide-react'

import { AvailabilitySlotInput, getDoctorAvailability, updateDoctorAvailability } from '../api/appointments'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ConfirmDialog'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const HOUR_TICKS = [0, 6, 12, 18, 24]
const MINUTES_PER_DAY = 24 * 60

const toHHMM = (value: string) => value.slice(0, 5)

const minutesOf = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

const formatMinutes = (total: number) => {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const formatHours = (hours: number) => {
  if (hours <= 0) return '0 h'
  if (Number.isInteger(hours)) return `${hours} h`
  return `${hours.toFixed(1).replace('.', ',')} h`
}

/** Normaliza horas a HH:MM y ordena por día y hora de inicio. */
const normalizeSlots = (slots: AvailabilitySlotInput[]): AvailabilitySlotInput[] =>
  slots
    .map((slot) => ({
      weekday: slot.weekday,
      start_time: toHHMM(slot.start_time),
      end_time: toHHMM(slot.end_time),
      is_active: slot.is_active,
    }))
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))

const slotsEqual = (a: AvailabilitySlotInput[], b: AvailabilitySlotInput[]) =>
  JSON.stringify(normalizeSlots(a)) === JSON.stringify(normalizeSlots(b))

const slotHours = (slot: AvailabilitySlotInput) =>
  Math.max(0, minutesOf(slot.end_time) - minutesOf(slot.start_time)) / 60

/** Busca el primer hueco libre de 1 h entre 07:00 y 21:00 para una nueva franja. */
function suggestSlot(slots: AvailabilitySlotInput[], weekday: number): AvailabilitySlotInput {
  const daySlots = slots.filter((slot) => slot.weekday === weekday && slot.is_active)
  const dayStart = 7 * 60
  const dayEnd = 21 * 60

  for (let start = dayStart; start + 60 <= dayEnd; start += 30) {
    const end = start + 60
    const overlaps = daySlots.some(
      (slot) => start < minutesOf(slot.end_time) && end > minutesOf(slot.start_time),
    )
    if (!overlaps) {
      return { weekday, start_time: formatMinutes(start), end_time: formatMinutes(end), is_active: true }
    }
  }

  return { weekday, start_time: '09:00', end_time: '10:00', is_active: true }
}

interface ValidationResult {
  rangeErrors: Set<number>
  overlapErrors: Set<number>
}

/** Detecta rangos inválidos y solapamientos entre franjas activas del mismo día. */
function validate(slots: AvailabilitySlotInput[]): ValidationResult {
  const rangeErrors = new Set<number>()
  const overlapErrors = new Set<number>()

  slots.forEach((slot, index) => {
    if (slot.start_time >= slot.end_time) rangeErrors.add(index)
  })

  for (let weekday = 0; weekday < 7; weekday++) {
    const indexes = slots
      .map((_, index) => index)
      .filter((index) => slots[index].weekday === weekday && slots[index].is_active && !rangeErrors.has(index))
      .sort((a, b) => slots[a].start_time.localeCompare(slots[b].start_time))

    for (let i = 1; i < indexes.length; i++) {
      if (slots[indexes[i]].start_time < slots[indexes[i - 1]].end_time) {
        overlapErrors.add(indexes[i])
        overlapErrors.add(indexes[i - 1])
      }
    }
  }

  return { rangeErrors, overlapErrors }
}

interface DayTimelineProps {
  entries: Array<{ slot: AvailabilitySlotInput; index: number }>
  errorIndexes: Set<number>
}

/** Barra visual de 24 h con las franjas de un día. */
function DayTimeline({ entries, errorIndexes }: DayTimelineProps) {
  const activeCount = entries.filter(({ slot }) => slot.is_active).length
  const label = entries
    .filter(({ slot }) => slot.is_active)
    .map(({ slot }) => `${slot.start_time} a ${slot.end_time}`)
    .join(', ')

  return (
    <div role="img" aria-label={activeCount > 0 ? `Franjas activas: ${label}` : 'Sin franjas activas'}>
      <div className="relative h-7 overflow-hidden rounded-lg bg-slate-100">
        {HOUR_TICKS.slice(1, -1).map((hour) => (
          <span
            key={hour}
            aria-hidden="true"
            className="absolute top-0 h-full w-px bg-slate-200"
            style={{ left: `${(hour / 24) * 100}%` }}
          />
        ))}
        {entries.map(({ slot, index }) => {
          const start = Math.max(0, minutesOf(slot.start_time))
          const end = Math.min(MINUTES_PER_DAY, minutesOf(slot.end_time))
          if (end <= start) return null
          const hasError = errorIndexes.has(index)
          return (
            <span
              key={index}
              title={`${slot.start_time} – ${slot.end_time}`}
              className={`absolute bottom-1 top-1 rounded-md border shadow-sm transition-colors ${
                hasError
                  ? 'border-red-400 bg-red-300'
                  : slot.is_active
                    ? 'border-emerald-500 bg-emerald-400/80'
                    : 'border-slate-300 bg-slate-300/80'
              }`}
              style={{
                left: `${(start / MINUTES_PER_DAY) * 100}%`,
                width: `${((end - start) / MINUTES_PER_DAY) * 100}%`,
              }}
            />
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-medium uppercase tracking-wide text-slate-500" aria-hidden="true">
        {HOUR_TICKS.map((hour) => (
          <span key={hour}>{String(hour).padStart(2, '0')}h</span>
        ))}
      </div>
    </div>
  )
}

export default function DoctorAvailability() {
  const toast = useToast()
  const [timezone, setTimezone] = useState('America/Bogota')
  const [savedSlots, setSavedSlots] = useState<AvailabilitySlotInput[]>([])
  const [draftSlots, setDraftSlots] = useState<AvailabilitySlotInput[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const timezoneClock = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('es-ES', {
        timeZone: timezone,
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(clock)
    } catch {
      return null
    }
  }, [clock, timezone])

  useEffect(() => {
    const loadAvailability = async () => {
      try {
        const response = await getDoctorAvailability()
        const normalized = normalizeSlots(response.slots)
        setTimezone(response.timezone)
        setSavedSlots(normalized)
        setDraftSlots(normalized)
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudo cargar tu disponibilidad.'))
      } finally {
        setLoading(false)
      }
    }
    loadAvailability()
  }, [toast])

  const { rangeErrors, overlapErrors } = useMemo(() => validate(draftSlots), [draftSlots])
  const errorIndexes = useMemo(
    () => new Set<number>([...rangeErrors, ...overlapErrors]),
    [rangeErrors, overlapErrors],
  )
  const errorCount = errorIndexes.size
  const activeSlots = draftSlots.filter((slot) => slot.is_active)
  const weeklyHours = activeSlots.reduce((total, slot) => total + slotHours(slot), 0)
  const dirty = !slotsEqual(draftSlots, savedSlots)

  // Evita cerrar la pestaña con cambios sin aplicar.
  useEffect(() => {
    if (!dirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  const updateSlot = (index: number, patch: Partial<AvailabilitySlotInput>) => {
    setDraftSlots((current) =>
      current.map((slot, currentIndex) => (currentIndex === index ? { ...slot, ...patch } : slot)),
    )
  }

  const addSlot = (weekday: number) => {
    setDraftSlots((current) => [...current, suggestSlot(current, weekday)])
  }

  const removeSlot = (index: number) => {
    setDraftSlots((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  /** Copia las franjas de un día a otro (reemplaza el día destino). */
  const copyDay = (sourceWeekday: number, targetWeekday: number) => {
    setDraftSlots((current) => {
      const source = current.filter((slot) => slot.weekday === sourceWeekday)
      const others = current.filter((slot) => slot.weekday !== targetWeekday)
      const copied = source.map((slot) => ({ ...slot, weekday: targetWeekday }))
      return [...others, ...copied]
    })
    toast.info(`${WEEKDAYS[sourceWeekday]} copiado a ${WEEKDAYS[targetWeekday]}.`)
  }

  const handleApply = async () => {
    if (errorCount > 0) return
    setSaving(true)
    try {
      const response = await updateDoctorAvailability({ timezone, slots: normalizeSlots(draftSlots) })
      const normalized = normalizeSlots(response.slots)
      setTimezone(response.timezone)
      setSavedSlots(normalized)
      setDraftSlots(normalized)
      toast.success('Disponibilidad actualizada. Los pacientes ya pueden reservar con tu nueva agenda.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo guardar la disponibilidad.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setDraftSlots(savedSlots)
    setConfirmDiscard(false)
    toast.info('Cambios descartados. Se restauró la última agenda guardada.')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-28">
      <PageHeader
        title="Disponibilidad médica"
        description="Ajusta tu agenda semanal. Los cambios se aplican solo al pulsar «Aplicar cambios»."
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Zona horaria</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{timezone}</p>
            <p className="mt-1 text-xs text-slate-500">Se configura en tu perfil médico.</p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-5 py-3 text-right text-slate-50">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Hora local</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{timezoneClock ?? 'Zona horaria inválida'}</p>
          </div>
        </div>
        {!timezoneClock && (
          <Alert tone="warning" className="mt-4">
            La zona horaria configurada no es válida. Actualízala en tu perfil profesional.
          </Alert>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          <Clock3 className="h-4 w-4" aria-hidden="true" />
          {formatHours(weeklyHours)} de disponibilidad semanal
        </div>
        <Badge tone="neutral">{activeSlots.length} franja(s) activa(s)</Badge>
        {dirty && <Badge tone="warning">Cambios sin aplicar</Badge>}
      </div>

      {activeSlots.length === 0 && (
        <Alert tone="warning" title="Sin disponibilidad activa">
          Ahora mismo no hay franjas activas: los pacientes no podrán reservar citas contigo hasta que actives alguna.
        </Alert>
      )}

      <div className="space-y-4">
        {WEEKDAYS.map((day, weekday) => {
          const entries = draftSlots
            .map((slot, index) => ({ slot, index }))
            .filter((entry) => entry.slot.weekday === weekday)
          const dayHours = entries
            .filter(({ slot }) => slot.is_active)
            .reduce((total, { slot }) => total + slotHours(slot), 0)

          return (
            <section key={day} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-slate-900">{day}</h2>
                  {dayHours > 0 ? (
                    <Badge tone="success">{formatHours(dayHours)}</Badge>
                  ) : (
                    <Badge tone="neutral">Sin franjas</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <CopyMenu
                    day={weekday}
                    onCopy={(target) => copyDay(weekday, target)}
                    disabled={entries.length === 0}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => addSlot(weekday)}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Agregar franja
                  </Button>
                </div>
              </div>

              <div className="mt-4">
                <DayTimeline entries={entries} errorIndexes={errorIndexes} />
              </div>

              {entries.length === 0 ? (
                <button
                  type="button"
                  onClick={() => addSlot(weekday)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-4 text-sm text-slate-500 transition-colors hover:border-emerald-400 hover:bg-emerald-50/40 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Añadir disponibilidad el {day.toLowerCase()}
                </button>
              ) : (
                <ul className="mt-4 space-y-2">
                  {entries.map(({ slot, index }) => {
                    const hasRangeError = rangeErrors.has(index)
                    const hasOverlapError = overlapErrors.has(index)
                    const hasError = hasRangeError || hasOverlapError
                    return (
                      <li
                        key={index}
                        className={`rounded-xl border p-3 transition-colors ${
                          hasError ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <label className="sr-only" htmlFor={`slot-${index}-start`}>
                              Hora de inicio de la franja del {day.toLowerCase()}
                            </label>
                            <input
                              id={`slot-${index}-start`}
                              type="time"
                              step={900}
                              value={slot.start_time}
                              onChange={(event) => updateSlot(index, { start_time: event.target.value })}
                              aria-invalid={hasError}
                              className="input-field w-32"
                            />
                            <span className="text-slate-500" aria-hidden="true">
                              –
                            </span>
                            <label className="sr-only" htmlFor={`slot-${index}-end`}>
                              Hora de fin de la franja del {day.toLowerCase()}
                            </label>
                            <input
                              id={`slot-${index}-end`}
                              type="time"
                              step={900}
                              value={slot.end_time}
                              onChange={(event) => updateSlot(index, { end_time: event.target.value })}
                              aria-invalid={hasError}
                              className="input-field w-32"
                            />
                          </div>

                          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                            <input
                              type="checkbox"
                              checked={slot.is_active}
                              onChange={(event) => updateSlot(index, { is_active: event.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            Activa
                          </label>

                          <span className="ml-auto text-xs text-slate-500">{formatHours(slotHours(slot))}</span>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSlot(index)}
                            aria-label={`Eliminar franja ${slot.start_time} - ${slot.end_time} del ${day.toLowerCase()}`}
                            className="text-red-600 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {hasError && (
                          <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                            {hasRangeError
                              ? 'La hora de inicio debe ser anterior a la de fin.'
                              : 'Esta franja se solapa con otra franja activa del mismo día.'}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {/* Barra de acciones fija */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p
            className={`text-sm ${
              errorCount > 0 ? 'font-medium text-red-600' : dirty ? 'font-medium text-amber-700' : 'text-slate-500'
            }`}
            aria-live="polite"
          >
            {errorCount > 0
              ? `Corrige ${errorCount} franja(s) con error antes de aplicar.`
              : dirty
                ? 'Tienes cambios sin aplicar.'
                : 'Tu agenda está guardada.'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setConfirmDiscard(true)}
              disabled={!dirty || saving}
              leftIcon={<RotateCcw className="h-4 w-4" />}
            >
              Descartar
            </Button>
            <Button
              onClick={handleApply}
              loading={saving}
              disabled={!dirty || errorCount > 0}
              leftIcon={<Check className="h-4 w-4" />}
            >
              Aplicar cambios
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        tone="danger"
        title="¿Descartar los cambios?"
        description="Se restaurará la última agenda guardada y perderás los ajustes que aún no has aplicado."
        confirmLabel="Descartar cambios"
        cancelLabel="Seguir editando"
        busy={saving}
        onConfirm={handleDiscard}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  )
}

interface CopyMenuProps {
  day: number
  disabled?: boolean
  onCopy: (targetWeekday: number) => void
}

/** Menú compacto para copiar las franjas de un día a otro. */
function CopyMenu({ day, disabled, onCopy }: CopyMenuProps) {
  const [open, setOpen] = useState(false)
  const targets = WEEKDAYS.map((label, index) => ({ label: WEEKDAYS_SHORT[index], full: label, index })).filter(
    (item) => item.index !== day,
  )

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        leftIcon={<Copy className="h-4 w-4" />}
      >
        <span className="hidden sm:inline">Copiar a…</span>
      </Button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          >
            <p className="px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-slate-500">Copiar a</p>
            {targets.map((target) => (
              <button
                key={target.index}
                type="button"
                role="menuitem"
                onClick={() => {
                  onCopy(target.index)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden="true" />
                {target.full}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
