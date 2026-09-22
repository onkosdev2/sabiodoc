import { describe, it, expect, vi } from 'vitest'
import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import Modal from './Modal'

describe('Modal', () => {
  it('renderiza el diálogo con su título', () => {
    render(<Modal open onClose={vi.fn()} title="Confirmar acción" />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Confirmar acción')).toBeInTheDocument()
  })

  it('enfoca el diálogo al abrir y se cierra con Escape', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="Título" />)

    expect(screen.getByRole('dialog')).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('atrapa el foco entre el primer y el último elemento (Tab / Shift+Tab)', () => {
    render(
      <Modal open onClose={vi.fn()} title="Título">
        <button>Uno</button>
        <button>Dos</button>
      </Modal>,
    )

    const close = screen.getByRole('button', { name: 'Cerrar' })
    const two = screen.getByRole('button', { name: 'Dos' })

    // Tab en el último elemento vuelve al primero.
    two.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(close).toHaveFocus()

    // Shift+Tab en el primero salta al último.
    close.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(two).toHaveFocus()
  })

  it('bloquea el scroll del fondo y lo restaura al cerrar', () => {
    const { rerender } = render(<Modal open onClose={vi.fn()} title="Título" />)
    expect(document.body.style.overflow).toBe('hidden')

    rerender(<Modal open={false} onClose={vi.fn()} title="Título" />)
    expect(document.body.style.overflow).toBe('')
  })

  it('devuelve el foco al elemento que lo tenía antes de abrir', () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Abrir'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(trigger).toHaveFocus()

    const { rerender } = render(<Modal open onClose={vi.fn()} title="Título" />)
    expect(screen.getByRole('dialog')).toHaveFocus()

    rerender(<Modal open={false} onClose={vi.fn()} title="Título" />)
    expect(trigger).toHaveFocus()

    trigger.remove()
  })

  it('respeta initialFocusRef para el foco inicial', () => {
    const focusRef = createRef<HTMLButtonElement>()
    render(
      <Modal open onClose={vi.fn()} title="Título" initialFocusRef={focusRef}>
        <button ref={focusRef}>Aceptar</button>
      </Modal>,
    )

    expect(screen.getByRole('button', { name: 'Aceptar' })).toHaveFocus()
  })
})
