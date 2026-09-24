import client from './client'

/** Borra un archivo propio desde cualquier contexto (consulta, cita o historial). */
export const deleteFile = async (fileId: number): Promise<void> => {
  await client.delete(`/files/${fileId}`)
}
