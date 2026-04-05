import { Link } from 'react-router-dom'
import { Search, MessageSquare, HelpCircle, Star, FileText, AlertTriangle, Briefcase } from 'lucide-react'

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto">
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

        <Link 
          to="/triage"
          className="card hover:shadow-lg transition-shadow group"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
              <MessageSquare className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                🗣️ Describir Mi Caso
              </h2>
              <p className="text-gray-600">
                Describe tus síntomas y nuestra IA te orientará hacia la especialidad más adecuada.
              </p>
            </div>
          </div>
        </Link>

        <Link 
          to="/guide"
          className="card hover:shadow-lg transition-shadow group"
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
                Responde unas preguntas sencillas y te guiaremos hacia la especialidad correcta.
              </p>
            </div>
          </div>
        </Link>

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
    </div>
  )
}
