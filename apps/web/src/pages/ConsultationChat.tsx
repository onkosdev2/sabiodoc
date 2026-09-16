import { Navigate, useParams } from 'react-router-dom'

import ConsultationChatView from '../components/ConsultationChatView'
import { useAuth } from '../context/AuthContext'

export default function ConsultationChat() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  if (!user) {
    return null
  }

  const consultationId = Number(id)
  if (!id || Number.isNaN(consultationId)) {
    return <Navigate to="/me/consultations" replace />
  }

  return (
    <div className="mx-auto max-w-4xl">
      <ConsultationChatView consultationId={consultationId} variant="page" />
    </div>
  )
}
