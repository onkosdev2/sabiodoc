import { useRef } from 'react'
import { FileText, Loader2, Paperclip, Trash2, Upload } from 'lucide-react'

import type { VideoSessionFile } from '../api/videoSessions'
import Button from './ui/Button'

export function formatFileSize(bytes: number): string {
  if (!bytes) return '0 KB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface SessionFilesPanelProps {
  files: VideoSessionFile[]
  enabled: boolean
  maxFiles: number
  currentRole: 'patient' | 'doctor'
  uploading: boolean
  onSelectFile: (file: File) => void
  onDelete?: (file: VideoSessionFile) => void
  deletingId?: number | null
}

/** Lista + carga de archivos compartidos durante la videoconsulta. */
export default function SessionFilesPanel({
  files,
  enabled,
  maxFiles,
  currentRole,
  uploading,
  onSelectFile,
  onDelete,
  deletingId,
}: SessionFilesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const myCount = files.filter((file) => file.uploader_role === currentRole).length
  const limitReached = myCount >= maxFiles

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Archivos compartidos
        </p>
        {enabled && (
          <span className="text-xs text-slate-500">
            {myCount}/{maxFiles}
          </span>
        )}
      </div>

      {!enabled ? (
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
          La carga de archivos no está habilitada en este entorno.
        </p>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onSelectFile(file)
              event.target.value = ''
            }}
          />
          <Button
            variant="secondary"
            className="w-full"
            loading={uploading}
            disabled={limitReached}
            leftIcon={<Upload className="h-4 w-4" />}
            onClick={() => inputRef.current?.click()}
          >
            {limitReached ? 'Límite alcanzado' : 'Enviar archivo'}
          </Button>
        </>
      )}

      {files.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Paperclip className="h-3.5 w-3.5" /> Aún no hay archivos en esta sesión.
        </p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"
            >
              <FileText className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <a
                  href={file.secure_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm font-medium text-slate-800 hover:text-primary-700"
                >
                  {file.original_name}
                </a>
                <p className="text-xs text-slate-500">
                  {file.uploader_role === 'doctor' ? 'Médico' : 'Paciente'} ·{' '}
                  {formatFileSize(file.bytes)}
                </p>
              </div>
              {onDelete && file.uploader_role === currentRole && (
                <button
                  type="button"
                  onClick={() => onDelete(file)}
                  disabled={deletingId === file.id}
                  aria-label={`Borrar ${file.original_name}`}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  {deletingId === file.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
