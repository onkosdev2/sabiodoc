import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, MessageSquare, HelpCircle, Star, FileText, AlertTriangle, Briefcase, X } from 'lucide-react'

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="max-w-4xl mx-auto relative">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Bienvenido a SabioDoc
        </h1>
        <p className="text-xl text-gray-600">
          Tu asistente de orientación médica inteligente
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Te ayudamos a encontrar la especialidad médica adecuada para tus necesidades
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* 1. Buscar Especialidad */}
        <Link 
          to="/specialties"
          className="card hover:shadow-lg transition-shadow group"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
              <Search className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                🔍 Buscar Especialidad
              </h2>
              <p className="text-gray-600">
                Busca por nombre o palabras clave entre todas las especialidades médicas disponibles.
              </p>
            </div>
          </div>
        </Link>

        {/* 2. No Sé Qué Especialidad Escoger (Abre el Popup) */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="card hover:shadow-lg transition-shadow group text-left w-full cursor-pointer"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
              <HelpCircle className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                💡 No Sé Qué Especialidad Escoger
              </h2>
              <p className="text-gray-600">
                Te ayudamos a descubrir la especialidad correcta según tus síntomas o respondiendo preguntas.
              </p>
            </div>
          </div>
        </button>

        {/* 4. Emergencias */}
        <Link 
          to="/emergency"
          className="card hover:shadow-lg transition-shadow group border-red-200"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                🚨 Emergencias
              </h2>
              <p className="text-gray-600">
                Información importante sobre cuándo acudir a urgencias.
              </p>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Link 
          to="/me/favorites"
          className="card hover:shadow-lg transition-shadow group bg-yellow-50"
        >
          <div className="flex items-center gap-4">
            <Star className="w-6 h-6 text-yellow-500" />
            <div>
              <h3 className="font-semibold text-gray-800">Mis Favoritos</h3>
              <p className="text-sm text-gray-600">Especialidades guardadas</p>
            </div>
          </div>
        </Link>

        <Link 
          to="/me/consultations"
          className="card hover:shadow-lg transition-shadow group bg-blue-50"
        >
          <div className="flex items-center gap-4">
            <FileText className="w-6 h-6 text-blue-500" />
            <div>
              <h3 className="font-semibold text-gray-800">Mis Consultas</h3>
              <p className="text-sm text-gray-600">Historial de consultas</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="mb-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-100 p-3">
              <Briefcase className="h-7 w-7 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-700">Onboarding médico</p>
              <h2 className="mt-1 text-2xl font-semibold text-gray-900">¿Quieres atender videoconsultas en SabioDoc?</h2>
              <p className="mt-2 text-gray-700">
                Postúlate con tus especialidades, descripción profesional y costo por minuto. Revisamos tu perfil antes de habilitar el panel médico.
              </p>
            </div>
          </div>
          <Link to="/doctor/apply" className="btn-primary whitespace-nowrap">
            Postular como médico
          </Link>
        </div>
      </div>

      <div className="bg-gray-100 rounded-xl p-6 text-center">
        <p className="text-gray-600 text-sm">
          ⚠️ <strong>Importante:</strong> SabioDoc es una herramienta de orientación. 
          No reemplaza la consulta con un profesional de la salud. 
          Si tienes una emergencia médica, llama a servicios de emergencia o acude a urgencias.
        </p>
      </div>

      {/* POPUP / MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-gray-100">
            {/* Botón de cerrar */}
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-block p-3 bg-purple-100 rounded-full mb-3 text-purple-600">
                <HelpCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800">¿Cómo prefieres que te ayudemos?</h3>
              <p className="text-sm text-gray-600 mt-1">
                Selecciona una de las opciones para encontrar tu especialidad ideal.
              </p>
            </div>

            <div className="space-y-3">
              {/* Opción 1: Describir mi caso */}
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  navigate('/triage')
                }}
                className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-green-500 hover:bg-green-50/50 transition-all group flex items-start gap-4 cursor-pointer"
              >
                <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors text-green-600 mt-0.5">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 group-hover:text-green-700">🗣️ Describir Mi Caso</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Cuéntanos tus síntomas libremente a nuestra IA.</p>
                </div>
              </button>

              {/* Opción 2: Guía de preguntas (Original /guide) */}
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  navigate('/guide')
                }}
                className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-purple-500 hover:bg-purple-50/50 transition-all group flex items-start gap-4 cursor-pointer"
              >
                <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors text-purple-600 mt-0.5">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 group-hover:text-purple-700">💡 Responder Preguntas Guía</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Te guiaremos paso a paso con preguntas sencillas.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}