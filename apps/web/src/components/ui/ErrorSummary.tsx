import { AlertCircle } from 'lucide-react'

interface ErrorSummaryProps {
  /** Errores por campo. Solo se muestra si hay dos o más. */
  errors: Record<string, string | undefined>
  title?: string
  className?: string
}

/**
 * Resumen de errores para formularios con varios campos inválidos.
 *
 * El foco se mueve al primer campo con `focusFirstInvalid`; este bloque
 * complementa el anuncio y ayuda a revisar el resto sin recorrer el formulario.
 */
export default function ErrorSummary({
  errors,
  title = 'Revisa los siguientes campos',
  className = '',
}: ErrorSummaryProps) {
  const messages = Object.values(errors).filter((message): message is string => Boolean(message))

  if (messages.length < 2) return null

  return (
    <div
      role="alert"
      className={`rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 ${className}`.trim()}
    >
      <p className="flex items-center gap-2 font-semibold">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  )
}
