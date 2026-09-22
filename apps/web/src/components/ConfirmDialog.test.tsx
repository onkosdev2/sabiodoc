import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ConfirmDialog from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('enfoca la acción "Cancelar" al abrir', () => {
    render(<ConfirmDialog open title="¿Eliminar cita?" onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('invoca onConfirm y onCancel según la acción elegida', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        title="¿Eliminar cita?"
        confirmLabel="Sí, eliminar"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
