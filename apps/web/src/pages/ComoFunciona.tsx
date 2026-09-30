import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Heart,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Video,
} from 'lucide-react'

import Card from '../components/ui/Card'

type Audience = 'patients' | 'doctors'

const PATIENT_FEATURES = [
  {
    icon: Sparkles,
    title: 'Encuentra tu especialidad con IA',
    description:
      'Describe tus síntomas o responde unas preguntas sencillas y te orientamos hacia la especialidad adecuada.',
  },
  {
    icon: ClipboardList,
    title: 'Llega a la consulta con tu historia lista',
    description:
      'La pre-consulta con IA arma una ficha clara con tus síntomas, antecedentes y medicamentos para el médico.',
  },
  {
    icon: Video,
    title: 'Videoconsulta segura',
    description:
      'Atiéndete por videollamada desde donde estés y paga solo por los minutos que uses. Sin paquetes ni costos ocultos.',
  },
  {
    icon: FileText,
    title: 'Resumen con los puntos clave',
    description:
      'Al terminar la videoconsulta, la IA la resume para que tú y tu médico revisen conclusiones e indicaciones.',
  },
  {
    icon: CalendarDays,
    title: 'Agenda como quieras',
    description: 'Elige un horario real del médico, reprograma o cancela sin complicaciones.',
  },
  {
    icon: Heart,
    title: 'Todo tu historial en un lugar',
    description: 'Consultas, citas, indicaciones y archivos compartidos, siempre disponibles.',
  },
  {
    icon: Star,
    title: 'Opiniones de pacientes reales',
    description: 'Decide con reseñas de personas que ya se atendieron con ese especialista.',
  },
]

const DOCTOR_FEATURES = [
  {
    icon: Search,
    title: 'Consigue más pacientes',
    description: 'Tu perfil público verificado aparece en las búsquedas por especialidad y ciudad.',
  },
  {
    icon: ClipboardList,
    title: 'Consulta más rápida',
    description:
      'Antes de la videollamada recibes un resumen de pre-consulta con los puntos clave del paciente.',
  },
  {
    icon: Video,
    title: 'Videoconsulta integrada',
    description: 'Atiende sin instalar nada, con sala segura y control de tiempo.',
  },
  {
    icon: FileText,
    title: 'Resumen automático de cada consulta',
    description:
      'Al terminar la videollamada, la IA genera un resumen con conclusiones e indicaciones para el paciente.',
  },
  {
    icon: LayoutDashboard,
    title: 'Panel completo',
    description: 'Agenda, pacientes, reseñas y cartera en un solo lugar.',
  },
  {
    icon: BadgeCheck,
    title: 'Perfil verificado',
    description: 'Validamos tu identidad y número de colegiatura (CMP/RNE) para dar confianza a los pacientes.',
  },
  {
    icon: CircleDollarSign,
    title: 'Tú defines tu tarifa',
    description: 'Cobras por minuto de videoconsulta. Sin costos fijos para empezar.',
  },
]

const PATIENT_STEPS = [
  {
    title: 'Cuenta tu caso',
    description: 'La IA te guía con preguntas sencillas y ordena tu información clínica.',
  },
  {
    title: 'Elige especialista y horario',
    description: 'Compara perfiles, reseñas y disponibilidad real, y agenda en segundos.',
  },
  {
    title: 'Conéctate a la videoconsulta',
    description: 'Entra a la sala segura desde tu navegador, sin descargas.',
  },
  {
    title: 'Recibe tu resumen',
    description: 'La IA resume la consulta con los puntos clave para ti y tu médico.',
  },
]

const DOCTOR_STEPS = [
  {
    title: 'Postúlate y verifica tu perfil',
    description: 'Completas tus datos profesionales y validamos tu identidad y colegiatura.',
  },
  {
    title: 'Configura tu agenda y tarifa',
    description: 'Defines tus horarios de atención y cuánto cobras por minuto de videoconsulta.',
  },
  {
    title: 'Atiende videoconsultas',
    description: 'Recibes al paciente con su ficha de pre-consulta ya resumida.',
  },
  {
    title: 'Cierra con seguimiento',
    description: 'La IA resume conclusiones e indicaciones para que el paciente las revise.',
  },
]

const TABS: { id: Audience; label: string; icon: typeof Heart }[] = [
  { id: 'patients', label: 'Para pacientes', icon: Heart },
  { id: 'doctors', label: 'Para médicos', icon: Stethoscope },
]

export default function ComoFunciona() {
  const [audience, setAudience] = useState<Audience>('patients')
  const features = audience === 'patients' ? PATIENT_FEATURES : DOCTOR_FEATURES
  const steps = audience === 'patients' ? PATIENT_STEPS : DOCTOR_STEPS
  const stepsTitle = audience === 'patients' ? 'Así funciona para pacientes' : 'Así funciona para médicos'

  return (
    <div className="space-y-10">
      {/* Hero: solo dos llamados a la acción, uno por audiencia */}
      <section className="overflow-hidden rounded-3xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-emerald-50 p-8 sm:p-12">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary-700">
            <Stethoscope className="h-4 w-4" /> Cómo funciona SabioDoc
          </span>
          <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
            Orientación médica con IA y videoconsultas, en un solo lugar
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Te ayudamos a encontrar la especialidad correcta, llegas a la consulta con tu historia lista y te
            atiendes por videollamada pagando solo por minuto.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/specialties" className="btn-primary">
              Buscar especialista
            </Link>
            <Link to="/doctor/apply" className="btn-secondary">
              Soy médico
            </Link>
          </div>
        </div>
      </section>

      {/* Pestañas por audiencia: beneficios + pasos propios de cada una */}
      <section>
        <div
          role="tablist"
          aria-label="Beneficios por tipo de usuario"
          className="mx-auto flex w-fit rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = audience === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={active}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setAudience(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  active ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div
          role="tabpanel"
          id={`panel-${audience}`}
          aria-labelledby={`tab-${audience}`}
          className="mt-8 space-y-10"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <Card key={feature.title} className="h-full">
                  <span className="inline-flex rounded-xl bg-primary-100 p-2.5 text-primary-700">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
                </Card>
              )
            })}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10">
            <h2 className="text-center text-2xl font-bold text-slate-900">{stepsTitle}</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <div key={step.title}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
                    {index + 1}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Confianza (sin botones, para no competir con los CTAs) */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-start gap-3">
          <BadgeCheck className="mt-0.5 h-6 w-6 flex-none text-emerald-600" aria-hidden="true" />
          <div>
            <h3 className="font-semibold text-slate-900">Médicos verificados</h3>
            <p className="mt-1 text-sm text-slate-600">
              Revisamos la identidad y el registro profesional de cada especialista antes de habilitar su perfil.
            </p>
          </div>
        </Card>
        <Card className="flex items-start gap-3">
          <Star className="mt-0.5 h-6 w-6 flex-none text-amber-500" aria-hidden="true" />
          <div>
            <h3 className="font-semibold text-slate-900">Reseñas de citas reales</h3>
            <p className="mt-1 text-sm text-slate-600">
              Las opiniones provienen de pacientes que completaron una consulta.
            </p>
          </div>
        </Card>
        <Card className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-6 w-6 flex-none text-sky-600" aria-hidden="true" />
          <div>
            <h3 className="font-semibold text-slate-900">Privacidad y seguridad</h3>
            <p className="mt-1 text-sm text-slate-600">
              Tus datos clínicos se tratan de forma confidencial y las videoconsultas son privadas.
            </p>
          </div>
        </Card>
      </section>

      <p className="text-center text-xs text-slate-500">
        La IA orienta, no reemplaza una consulta médica profesional.
      </p>
    </div>
  )
}
