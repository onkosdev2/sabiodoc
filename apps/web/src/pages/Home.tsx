import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BookOpenText,
  Briefcase,
  FileText,
  HelpCircle,
  History,
  MessageSquare,
  Search,
  Star,
} from 'lucide-react'

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
    <div className="relative mx-auto max-w-4xl">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-slate-800">Bienvenido a SabioDoc</h1>
        <p className="mt-4 text-xl text-slate-600">Tu asistente de orientación médica inteligente</p>
        <p className="mt-2 text-sm text-slate-500">
          Te ayudamos a encontrar la especialidad médica adecuada para tus necesidades
        </p>
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <Link
          to="/specialties"
          className="card group transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary-100 p-3 transition-colors group-hover:bg-primary-200">
              <Search className="h-8 w-8 text-primary-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="mb-2 text-xl font-semibold text-slate-800">Buscar especialidad</h2>
              <p className="text-slate-600">
                Busca por nombre o palabras clave entre todas las especialidades médicas disponibles.
              </p>
            </div>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="card group w-full cursor-pointer text-left transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-violet-100 p-3 transition-colors group-hover:bg-violet-200">
              <HelpCircle className="h-8 w-8 text-violet-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="mb-2 text-xl font-semibold text-slate-800">No sé qué especialidad escoger</h2>
              <p className="text-slate-600">Te ayudamos a descubrir la especialidad correcta usando IA.</p>
            </div>
          </div>
        </button>

        <Link
          to="/emergency"
          className="card group border-red-200 transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 md:col-span-2"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-red-100 p-3 transition-colors group-hover:bg-red-200">
              <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="mb-2 text-xl font-semibold text-slate-800">Emergencias</h2>
              <p className="text-slate-600">Información importante sobre cuándo acudir a urgencias.</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <Link
          to="/me/favorites"
          className="card group bg-amber-50 transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <div className="flex items-center gap-4">
            <Star className="h-6 w-6 text-amber-500" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-800">Mis favoritos</h3>
              <p className="text-sm text-slate-600">Médicos guardados</p>
            </div>
          </div>
        </Link>

        <Link
          to="/me/consultations"
          className="card group bg-primary-50 transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <div className="flex items-center gap-4">
            <FileText className="h-6 w-6 text-primary-500" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-slate-800">Mis consultas</h3>
              <p className="text-sm text-slate-600">Historial de consultas</p>
            </div>
          </div>
        </Link>
      </div>

      {!isLoading && !isAuthenticated && (
        <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-emerald-100 p-3">
                <Briefcase className="h-7 w-7 text-emerald-700" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-emerald-700">Onboarding médico</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                  ¿Quieres atender videoconsultas en SabioDoc?
                </h2>
                <p className="mt-2 text-slate-700">
                  Postúlate con tus especialidades, descripción profesional y costo por minuto. Revisamos tu perfil
                  antes de habilitar el panel médico.
                </p>
              </div>
            </div>
            <Link to="/doctor/apply" className="btn-primary whitespace-nowrap">
              Postular como médico
            </Link>
          </div>
        </div>
      )}

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
