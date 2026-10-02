import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BookOpenText,
  Briefcase,
  FileText,
  HelpCircle,
  History,
  MessageSquare,
  Search,
  Star,
  Image as ImageIcon // Solo para el placeholder de la ilustración
} from 'lucide-react'
import heroImage from '../assets/home-hero.jpeg'

import { useAuth } from '../context/AuthContext'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'

const MODAL_OPTIONS = [
  {
    to: '/triage',
    icon: MessageSquare,
    title: 'Describir mi caso',
    description: 'Cuéntanos tus síntomas libremente a nuestra IA.',
    accent: 'text-emerald-600 bg-emerald-100 group-hover:bg-emerald-200',
  },
  {
    to: '/guide',
    icon: BookOpenText,
    title: 'Guía de especialidades',
    description: 'Te guiamos paso a paso con preguntas sencillas generadas por IA.',
    accent: 'text-violet-600 bg-violet-100 group-hover:bg-violet-200',
  },
  {
    to: '/me/history',
    icon: History,
    title: 'Historial de orientaciones',
    description: 'Revisa tus consultas anteriores de ambas herramientas.',
    accent: 'text-primary-600 bg-primary-100 group-hover:bg-primary-200',
  },
] as const

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useAuth()

  return (
    <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Sección Hero con Jerarquía Mejorada */}
      <div className="mb-14 flex flex-col-reverse items-center gap-10 md:flex-row md:justify-between">
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Bienvenido a SabioDoc
          </h1>
          <p className="mt-4 text-xl font-medium text-slate-700">
            Tu asistente de orientación médica inteligente
          </p>
          <p className="mt-2 text-base text-slate-500">
            Te ayudamos a encontrar la especialidad médica adecuada para tus necesidades y agendar videollamadas con medicos, todo apoyado por inteligencia artificial.
          </p>
          {!isLoading && !isAuthenticated && (
            <Link
              to="/como-funciona"
              className="mt-8 inline-flex items-center gap-2 rounded-full border-2 border-slate-200 bg-transparent px-6 py-3 font-semibold text-slate-700 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Conoce cómo funciona SabioDoc
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          )}
        </div>
        
        {/* Contenedor principal de la Imagen Hero */}
        <div className="hidden flex-1 md:flex md:items-center md:justify-end pointer-events-none">
          <img
            src={heroImage}
            alt="Ilustración de videoconsulta médica en SabioDoc"
            className="
              w-full 
              max-w-[700px] 
              h-auto 
              mix-blend-multiply 
              scale-[1.8] 
              origin-center 
              [clip-path:inset(10%_8%_10%_8%)]
            "
          />
        </div>
      </div>

      {/* Grid de Tarjetas Principales */}
      <div className="mb-12 grid gap-6 md:grid-cols-2">
        {/* Tarjetas Siempre Visibles */}
        <Link
          to="/specialties"
          className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-blue-50 p-3.5 transition-colors group-hover:bg-blue-100">
              <Search className="h-7 w-7 text-blue-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="mb-1 text-xl font-bold text-slate-800">Buscar especialidad</h2>
              <p className="text-slate-500 leading-relaxed">
                Busca por nombre o palabras clave entre todas las especialidades médicas disponibles.
              </p>
            </div>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="group flex w-full cursor-pointer flex-col rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-violet-50 p-3.5 transition-colors group-hover:bg-violet-100">
              <HelpCircle className="h-7 w-7 text-violet-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="mb-1 text-xl font-bold text-slate-800">No sé qué especialidad escoger</h2>
              <p className="text-slate-500 leading-relaxed">
                Te ayudamos a descubrir la especialidad correcta usando IA.
              </p>
            </div>
          </div>
        </button>

        {/* Tarjetas Exclusivas para Usuarios Logueados */}
        {isAuthenticated && (
          <>
            <Link
              to="/me/favorites"
              className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-amber-50 p-3.5 transition-colors group-hover:bg-amber-100">
                  <Star className="h-7 w-7 text-amber-500" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="mb-1 text-lg font-bold text-slate-800">Mis favoritos</h3>
                  <p className="text-slate-500">Médicos guardados</p>
                </div>
              </div>
            </Link>

            <Link
              to="/me/consultations"
              className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-emerald-50 p-3.5 transition-colors group-hover:bg-emerald-100">
                  <FileText className="h-7 w-7 text-emerald-600" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="mb-1 text-lg font-bold text-slate-800">Mis consultas</h3>
                  <p className="text-slate-500">Historial de consultas</p>
                </div>
              </div>
            </Link>
          </>
        )}

        {/* Tarjeta de Emergencias (Siempre Visible, Ancho Completo) */}
        <Link
          to="/emergency"
          className="group md:col-span-2 flex flex-col rounded-2xl border border-red-100 bg-red-50/50 p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-red-100 p-3.5 transition-colors group-hover:bg-red-200">
              <AlertTriangle className="h-7 w-7 text-red-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="mb-1 text-xl font-bold text-slate-800">Emergencias</h2>
              <p className="text-slate-600">Información importante sobre cuándo acudir a urgencias.</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Banner de Onboarding (Solo Visitantes) */}
      {!isLoading && !isAuthenticated && (
        <div className="mb-8 overflow-hidden rounded-3xl border border-emerald-100 bg-emerald-50 relative">
          <div className="relative z-10 flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex max-w-2xl items-start gap-5">
              <div className="shrink-0 rounded-2xl bg-emerald-100 p-4">
                <Briefcase className="h-8 w-8 text-emerald-700" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">
                  Onboarding médico
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  ¿Quieres atender videoconsultas en SabioDoc?
                </h2>
                <p className="mt-2 text-slate-700 leading-relaxed">
                  Postúlate con tus especialidades, descripción profesional y costo por minuto. Revisamos tu perfil
                  antes de habilitar el panel médico.
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <Link 
                to="/doctor/apply" 
                className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl bg-emerald-600 px-6 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:w-auto"
              >
                Postular como médico
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modal Intacto */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="¿Cómo prefieres que te ayudemos?"
        description="Selecciona una opción para encontrar tu especialidad ideal."
        icon={
          <span className="inline-flex rounded-full bg-violet-100 p-2 text-violet-600">
            <HelpCircle className="h-5 w-5" aria-hidden="true" />
          </span>
        }
        className="max-w-lg"
      >
        <div className="space-y-3">
          {MODAL_OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.to}
                type="button"
                onClick={() => {
                  setIsModalOpen(false)
                  navigate(option.to)
                }}
                className="group flex w-full items-start gap-4 rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-primary-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <span className={`mt-0.5 rounded-lg p-2 transition-colors ${option.accent}`}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span>
                  <span className="font-semibold text-slate-800">{option.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
                </span>
              </button>
            )
          })}
        </div>

        <Alert tone="warning" className="mt-4">
          <strong>Importante:</strong> las herramientas de IA de SabioDoc son para orientación. No reemplazan la
          consulta con un profesional de la salud.
        </Alert>

        <div className="mt-4 text-center">
          <Badge tone="neutral">Orientación con IA, no diagnóstico</Badge>
        </div>
      </Modal>
    </div>
  )
}