import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

import Button from './ui/Button'
import Modal from './ui/Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmación de una acción (con modal accesible y foco en "Cancelar"). */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus()
    }
  }, [open])

  return (
    <Modal
      open={open}
      onClose={() => !busy && onCancel()}
      title={title}
      description={description}
      icon={
        <span
          className={`inline-flex rounded-full p-2 ${
            tone === 'danger' ? 'bg-red-100 text-red-600' : 'bg-primary-100 text-primary-600'
          }`}
        >
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
      }
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
