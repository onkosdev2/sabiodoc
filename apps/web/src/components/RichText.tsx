import { Fragment, ReactNode } from 'react'

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    const match = part.match(/^\*\*([^*]+)\*\*$/)
    if (match) {
      return (
        <strong key={`${keyPrefix}-${index}`} className="font-semibold">
          {match[1]}
        </strong>
      )
    }
    return <Fragment key={`${keyPrefix}-${index}`}>{part}</Fragment>
  })
}

interface RichTextProps {
  text: string
  className?: string
}

/** Renderiza texto del asistente con **negritas**, encabezados y viñetas, sin HTML crudo. */
export default function RichText({ text, className = '' }: RichTextProps) {
  const lines = text.split('\n')
  return (
    <div className={`space-y-1 ${className}`}>
      {lines.map((line, index) => {
        const key = `line-${index}`
        if (!line.trim()) return <div key={key} className="h-2" />

        const heading = line.match(/^#{1,3}\s+(.*)$/)
        if (heading) {
          return (
            <p key={key} className="font-semibold">
              {renderInline(heading[1], key)}
            </p>
          )
        }

        const bullet = line.match(/^\s*[-•]\s+(.*)$/)
        if (bullet) {
          return (
            <p key={key} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span className="min-w-0">{renderInline(bullet[1], key)}</span>
            </p>
          )
        }

        return <p key={key}>{renderInline(line, key)}</p>
      })}
    </div>
  )
}
