import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Calendar, ExternalLink, MessageCircle, Video } from 'lucide-react'
import { getMyConsultations, Consultation } from '../api/consultations'
import { useAuth } from '../context/AuthContext'
import BackButton from '../components/BackButton'
import StructuredIntakeCard from '../components/StructuredIntakeCard'

export default function MyConsultations() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
      return
    }

    const loadConsultations = async () => {
      if (!isAuthenticated) return
      
      try {
        const data = await getMyConsultations()
        setConsultations(data.consultations)
      } catch (error) {
        console.error('Error loading consultations:', error)
      } finally {
        setLoading(false)
      }
    }
    
    if (isAuthenticated) {
      loadConsultations()
    }
  }, [isAuthenticated, authLoading, navigate])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const statusLabels = {
    created: { label: 'Creada', color: 'bg-blue-100 text-blue-700' },
    active: { label: 'Activa', color: 'bg-green-100 text-green-700' },
    closed: { label: 'Cerrada', color: 'bg-gray-100 text-gray-700' }
  }

  return (
    <div>
      <BackButton />
      
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        📋 Mis Consultas
      </h1>

      {consultations.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No tienes consultas registradas</p>
          <Link to="/specialties" className="btn-primary">
            Buscar especialidad
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {consultations.map((consultation) => (
            <div key={consultation.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {consultation.specialty?.name || 'Especialidad'}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusLabels[consultation.status].color}`}>
                      {statusLabels[consultation.status].label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Creada: {formatDate(consultation.created_at)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    ID: {consultation.room_id}
                  </p>
                </div>
                
                {consultation.specialty && (
                  <Link
                    to={`/specialties/${consultation.specialty.slug}`}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </Link>
                )}
              </div>
              
              {/* Botones de acción */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3">
                {consultation.status !== 'closed' && (
                  <Link
                    to={`/consultation/${consultation.id}/chat`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {consultation.status === 'created' ? 'Iniciar pre-consulta IA' : 'Continuar chat IA'}
                  </Link>
                )}
                
                {consultation.summary && (
                  <Link
                    to={`/consultation/${consultation.id}/book`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors"
                  >
                    <Video className="w-4 h-4" />
                    Agendar videoconsulta
                  </Link>
                )}
              </div>
              
              {consultation.summary && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Resumen para el médico:</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{consultation.summary}</p>
                </div>
              )}

              {consultation.intake && (
                <StructuredIntakeCard
                  intake={consultation.intake}
                  title="Ficha clínica previa"
                  className="mt-4"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
