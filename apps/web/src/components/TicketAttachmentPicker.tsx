import { useRef, useState } from 'react'
import { FileText, Loader2, Paperclip, X } from 'lucide-react'

import { SupportAttachment, uploadSupportAttachment } from '../api/support'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import Button from './ui/Button'

interface TicketAttachmentPickerProps {
  attachments: SupportAttachment[]
  onChange: (attachments: SupportAttachment[]) => void
  max?: number
}

/** Selector de adjuntos para tickets: sube a Cloudinary y devuelve metadatos. */
export default function TicketAttachmentPicker({
  attachments,
  onChange,
  max = 5,
}: TicketAttachmentPickerProps) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const room = max - attachments.length
    if (room <= 0) {
      toast.error(`Máximo ${max} adjuntos.`)
      return
    }
    setUploading(true)
    try {
      const uploaded: SupportAttachment[] = []
      for (const file of Array.from(files).slice(0, room)) {
        uploaded.push(await uploadSupportAttachment(file))
      }
      onChange([...attachments, ...uploaded])
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo subir el adjunto.'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <span
              key={attachment.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
            >
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <span className="max-w-[180px] truncate">{attachment.original_name}</span>
              <button
                type="button"
                onClick={() => onChange(attachments.filter((item) => item.id !== attachment.id))}
                className="text-slate-400 hover:text-rose-600"
                aria-label={`Quitar ${attachment.original_name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || attachments.length >= max}
        leftIcon={uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
      >
        {uploading ? 'Subiendo...' : 'Adjuntar (imagen o PDF)'}
      </Button>
    </div>
  )
}
