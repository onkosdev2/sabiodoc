import type { ReactNode } from 'react'

import Alert from './ui/Alert'
import Card from './ui/Card'
import PageHeader from './ui/PageHeader'

export interface LegalSection {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

interface LegalPageProps {
  title: string
  description: string
  updated: string
  intro?: ReactNode
  sections: LegalSection[]
}

/**
 * Plantilla de páginas legales.
 *
 * Los textos son un **borrador provisional** y deben ser revisados por asesoría
 * legal antes de considerarse definitivos.
 */
export default function LegalPage({ title, description, updated, intro, sections }: LegalPageProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={title} description={description} />

      <Alert tone="warning" title="Borrador provisional">
        Este documento es un <strong>borrador</strong> y no constituye asesoría legal. Debe ser
        revisado y aprobado por un profesional antes de considerarse definitivo.
      </Alert>

      <Card>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
          Última actualización: {updated}
        </p>

        {intro && <div className="mt-4 text-sm leading-relaxed text-slate-700">{intro}</div>}

        <div className="mt-6 space-y-6">
          {sections.map((section, index) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold text-slate-900">
                {index + 1}. {section.heading}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-sm leading-relaxed text-slate-700">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-relaxed text-slate-700">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <p className="mt-8 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Para consultas sobre este documento, escríbenos desde <strong>Ayuda y soporte</strong> o al
          correo de contacto que se publique oficialmente.
        </p>
      </Card>
    </div>
  )
}
