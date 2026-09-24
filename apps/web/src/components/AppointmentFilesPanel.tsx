import { useState } from 'react'

import { uploadAppointmentFile } from '../api/appointments'
import { deleteFile } from '../api/files'
import type { VideoSessionFile } from '../api/videoSessions'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../utils/apiError'
import ConfirmDialog from './ConfirmDialog'
import SessionFilesPanel from './SessionFilesPanel'

const MAX_FILES = 10

interface AppointmentFilesPanelProps {
  appointmentId: number
  files: VideoSessionFile[]
  enabled: boolean
  role: 'patient' | 'doctor'
  onFilesChange: (files: VideoSessionFile[]) => void
}

/**
 * Archivos de una cita: permite enviar/descargar/borrar incluso después de la
 * videoconsulta (p. ej. el médico envía una receta cuando la tiene lista).
 */
export default function AppointmentFilesPanel({
  appointmentId,
  files,
  enabled,
  role,
  onFilesChange,
}: AppointmentFilesPanelProps) {
  const toast = useToast()
  const [uploading, setUploading] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<VideoSessionFile | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const record = await uploadAppointmentFile(appointmentId, file)
      onFilesChange([...files, record])
      toast.success('Archivo enviado.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo subir el archivo.'))
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!fileToDelete) return
    setDeleting(true)
    try {
      await deleteFile(fileToDelete.id)
      onFilesChange(files.filter((item) => item.id !== fileToDelete.id))
      setFileToDelete(null)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo borrar el archivo.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <SessionFilesPanel
        files={files}
        enabled={enabled}
        maxFiles={MAX_FILES}
        currentRole={role}
        uploading={uploading}
        onSelectFile={handleUpload}
        onDelete={setFileToDelete}
        deletingId={deleting ? fileToDelete?.id ?? null : null}
      />
      <ConfirmDialog
        open={fileToDelete !== null}
        tone="danger"
        title="¿Borrar el archivo?"
        description={
          fileToDelete ? `Se eliminará "${fileToDelete.original_name}" de esta cita.` : undefined
        }
        confirmLabel="Borrar archivo"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setFileToDelete(null)
        }}
      />
    </>
  )
}
