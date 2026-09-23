import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import SessionFilesPanel, { formatFileSize } from './SessionFilesPanel'
import type { VideoSessionFile } from '../api/videoSessions'

function makeFile(overrides: Partial<VideoSessionFile> = {}): VideoSessionFile {
  return {
    id: 1,
    video_session_id: 5,
    appointment_id: 2,
    uploader_id: 10,
    uploader_role: 'doctor',
    original_name: 'receta.pdf',
    content_type: 'application/pdf',
    resource_type: 'raw',
    file_format: 'pdf',
    bytes: 2048,
    url: 'http://example.com/receta.pdf',
    secure_url: 'https://example.com/receta.pdf',
    created_at: '2026-01-01T10:00:00Z',
    ...overrides,
  }
}

const baseProps = {
  enabled: true,
  maxFiles: 10,
  currentRole: 'patient' as const,
  uploading: false,
  onSelectFile: vi.fn(),
}

describe('SessionFilesPanel', () => {
  it('lista los archivos con su emisor y enlace', () => {
    render(<SessionFilesPanel {...baseProps} files={[makeFile()]} />)

    expect(screen.getByText('receta.pdf')).toHaveAttribute('href', 'https://example.com/receta.pdf')
    expect(screen.getByText(/Médico · 2 KB/)).toBeInTheDocument()
  })

  it('muestra un aviso si la carga no está habilitada', () => {
    render(<SessionFilesPanel {...baseProps} files={[]} enabled={false} />)

    expect(screen.getByText(/no está habilitada/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar archivo' })).not.toBeInTheDocument()
  })

  it('deshabilita el envío al alcanzar el límite del participante', () => {
    const files = Array.from({ length: 10 }, (_, index) =>
      makeFile({ id: index + 1, uploader_role: 'patient' }),
    )
    render(<SessionFilesPanel {...baseProps} files={files} />)

    expect(screen.getByRole('button', { name: 'Límite alcanzado' })).toBeDisabled()
  })

  it('entrega el archivo seleccionado', () => {
    const onSelectFile = vi.fn()
    const { container } = render(
      <SessionFilesPanel {...baseProps} files={[]} onSelectFile={onSelectFile} />,
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(onSelectFile).toHaveBeenCalledWith(file)
  })

  it('solo muestra el botón de borrar en los archivos propios', () => {
    render(
      <SessionFilesPanel
        {...baseProps}
        files={[
          makeFile({ id: 1, uploader_role: 'patient', original_name: 'mio.txt' }),
          makeFile({ id: 2, uploader_role: 'doctor', original_name: 'suyo.txt' }),
        ]}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Borrar mio.txt' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Borrar suyo.txt' })).not.toBeInTheDocument()
  })

  it('pide borrar el archivo al pulsar la papelera', async () => {
    const onDelete = vi.fn()
    const file = makeFile({ id: 7, uploader_role: 'patient', original_name: 'error.txt' })
    render(<SessionFilesPanel {...baseProps} files={[file]} onDelete={onDelete} />)

    await userEvent.click(screen.getByRole('button', { name: 'Borrar error.txt' }))
    expect(onDelete).toHaveBeenCalledWith(file)
  })
})

describe('formatFileSize', () => {
  it('formatea bytes de forma legible', () => {
    expect(formatFileSize(0)).toBe('0 KB')
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2 KB')
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})
