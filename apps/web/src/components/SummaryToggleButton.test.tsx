import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import SummaryToggleButton from './SummaryToggleButton'

describe('SummaryToggleButton', () => {
  it('muestra "Ver resumen" sin expandir y anuncia aria-expanded=false', () => {
    render(<SummaryToggleButton expanded={false} onClick={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Ver resumen' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('muestra "Ocultar resumen" expandido y anuncia aria-expanded=true', () => {
    render(<SummaryToggleButton expanded onClick={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Ocultar resumen' })
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('dispara onClick al pulsar', async () => {
    const onClick = vi.fn()
    render(<SummaryToggleButton expanded={false} onClick={onClick} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ver resumen' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('permite etiquetas personalizadas', () => {
    render(
      <SummaryToggleButton expanded collapsedLabel="Ver más" expandedLabel="Ver menos" onClick={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: 'Ver menos' })).toBeInTheDocument()
  })

  it('en tamaño sm aplica tipografía pequeña', () => {
    render(<SummaryToggleButton expanded={false} size="sm" onClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Ver resumen' })).toHaveClass('text-xs')
  })
})
