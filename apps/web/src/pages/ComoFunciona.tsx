import { useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  CalendarDays,
  ChevronDown,
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
import heroImage from '../assets/comofunciona-hero.webp'
import flujoMedico from '../assets/flujo-medico.webp'
import flujoPaciente from '../assets/flujo-paciente.webp'

type Audience = 'patients' | 'doctors'

const CONTENT = {
  patients: {
    features: [
      { icon: Sparkles, title: 'Orientación con IA', description: 'Describe cómo te sientes y te sugerimos la especialidad adecuada.' },
      { icon: ClipboardList, title: 'Pre-consulta lista', description: 'Tu médico recibe tus síntomas, antecedentes y medicamentos ya ordenados.' },
      { icon: Video, title: 'Pagas por minuto', description: 'Videoconsulta desde donde estés, sin paquetes ni costos ocultos.' },
      { icon: FileText, title: 'Resumen e historial', description: 'Consultas, indicaciones y archivos compartidos, siempre disponibles.' },
      { icon: CalendarDays, title: 'Agenda flexible', description: 'Elige un horario real del médico y cámbialo si surge un imprevisto.' },
      { icon: Star, title: 'Reseñas reales', description: 'Opiniones de pacientes que ya se atendieron con ese especialista.' },
    ],
    faqs: [
      { q: '¿Cuánto cuesta una videoconsulta?', a: 'Pagas solo por los minutos que dura tu videoconsulta. Cada médico define su tarifa por minuto y no hay paquetes ni costos ocultos.' },
      { q: '¿Necesito instalar algo?', a: 'No. Entras a una sala segura desde tu navegador, en computadora o celular.' },
      { q: '¿La IA reemplaza al médico?', a: 'No. La IA te orienta, ordena tu información y resume la consulta. El diagnóstico y las indicaciones los da tu médico.' },
      { q: '¿Cómo sé que el médico es real?', a: 'Revisamos la identidad y el registro profesional (CMP/RNE) de cada especialista antes de habilitar su perfil.' },
      { q: '¿Puedo reprogramar o cancelar mi cita?', a: 'Sí, puedes reprogramar o cancelar tu cita sin complicaciones.' },
    ],
  },
  doctors: {
    features: [
      { icon: Search, title: 'Más pacientes', description: 'Tu perfil verificado aparece en búsquedas por especialidad y ciudad.' },
      { icon: ClipboardList, title: 'Consultas más ágiles', description: 'Llegas a la videollamada con los puntos clave del caso.' },
      { icon: Video, title: 'Videoconsulta integrada', description: 'Sala segura y control de tiempo, sin instalar nada.' },
      { icon: FileText, title: 'Resumen automático', description: 'Conclusiones e indicaciones listas al terminar cada consulta.' },
      { icon: LayoutDashboard, title: 'Panel completo', description: 'Agenda, pacientes, reseñas y cartera en un solo lugar.' },
      { icon: CircleDollarSign, title: 'Tú fijas tu tarifa', description: 'Cobras por minuto de videoconsulta, sin costos fijos.' },
    ],
    faqs: [
      { q: '¿Cuánto cuesta empezar?', a: 'No hay costos fijos para empezar. Cobras por minuto de videoconsulta con la tarifa que tú defines.' },
      { q: '¿Cómo verifican mi perfil?', a: 'Validamos tu identidad y tu número de colegiatura (CMP/RNE) antes de publicar tu perfil.' },
      { q: '¿Qué es la pre-consulta?', a: 'Es un resumen con los síntomas, antecedentes y medicamentos del paciente, que recibes antes de la videollamada.' },
      { q: '¿Necesito instalar algo?', a: 'No. La videoconsulta se realiza en una sala segura desde el navegador.' },
      { q: '¿Qué incluye el resumen de la consulta?', a: 'Conclusiones e indicaciones para que el paciente las revise al terminar la videollamada.' },
    ],
  },
} as const

const TABS: { id: Audience; label: string; icon: typeof Heart }[] = [
  { id: 'patients', label: 'Pacientes', icon: Heart },
  { id: 'doctors', label: 'Médicos', icon: Stethoscope },
]

const TRUST = [
  { icon: BadgeCheck, color: 'text-emerald-600', title: 'Médicos verificados', text: 'Revisamos identidad y registro profesional antes de habilitar cada perfil.' },
  { icon: Star, color: 'text-amber-500', title: 'Reseñas de citas reales', text: 'Las opiniones vienen de pacientes que completaron una consulta.' },
  { icon: ShieldCheck, color: 'text-sky-600', title: 'Privacidad y seguridad', text: 'Tus datos clínicos son confidenciales y las videoconsultas, privadas.' },
]

// Infografías con los pasos resumidos (una por audiencia)
const FLOW_IMAGE = {
  patients: {
    src: flujoPaciente,
    alt: 'Infografía con los pasos para el paciente: cuenta tu caso, elige especialista y horario, conéctate a la videoconsulta y recibe tu resumen.',
  },
  doctors: {
    src: flujoMedico,
    alt: 'Infografía con los pasos para el médico: postula y verifica tu perfil, configura agenda y tarifa, atiende videoconsultas y cierra con seguimiento.',
  },
} as const

const CLOSING = {
  patients: { title: 'Crea tu cuenta hoy', text: 'Regístrate gratis y empieza a orientarte con IA en pocos minutos.', label: 'Registrarse', to: '/register' },
  doctors: { title: 'Atiende pacientes a tu manera', text: 'Postula, define tu tarifa y empieza cuando quieras.', label: 'Postular como médico', to: '/doctor/apply' },
}

const ANIMATION_CSS = `
@keyframes panel-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.panel-in { animation: panel-in 300ms ease-out; }
@media (prefers-reduced-motion: reduce) { .panel-in { animation: none; } }
`

export default function ComoFunciona() {
  const [audience, setAudience] = useState<Audience>('patients')
  const { features, faqs } = CONTENT[audience]
  const flow = FLOW_IMAGE[audience]
  const closing = CLOSING[audience]

  const handleTabKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next: Audience = audience === 'patients' ? 'doctors' : 'patients'
    setAudience(next)
    document.getElementById(`tab-${next}`)?.focus()
  }

  return (
    <div className="space-y-14 py-8">
      {/* 1. Hero: propuesta de valor + imagen del producto */}
      <section className="px-6 sm:px-12">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Orientación médica con IA y videoconsultas, en un solo lugar
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Te ayudamos a encontrar la especialidad correcta, llegas a la consulta con tu historia lista y te
              atiendes por videollamada pagando solo por minuto.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link to="/register" className="btn-primary">
                Registrarse
              </Link>
              <Link to="/doctor/apply" className="btn-secondary">
                Soy médico
              </Link>
            </div>
          </div>
          <div className="hidden flex-1 pointer-events-none md:flex md:items-center md:justify-end">
            <img
              src={heroImage}
              alt="Paciente en videoconsulta con su médico desde el computador"
              className="h-auto w-full max-w-[700px] mix-blend-multiply scale-[1.8] origin-center [clip-path:inset(10%_8%_10%_8%)]"
            />
          </div>
        </div>
      </section>

      {/* 2. Confianza: antes de pedir que el usuario siga leyendo */}
      <section aria-label="Confianza y seguridad">
        <ul className="grid gap-6 rounded-3xl bg-slate-50 p-6 sm:p-8 md:grid-cols-3 md:gap-8">
          {TRUST.map(({ icon: Icon, color, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <Icon className={`mt-0.5 h-6 w-6 flex-none ${color}`} aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. Contenido por audiencia */}
      <section>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-500">¿Cómo quieres usar SabioDoc?</p>
          <div
            role="tablist"
            aria-label="Tipo de usuario"
            onKeyDown={handleTabKeys}
            className="relative mt-3 inline-grid grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
          >
            {/* Píldora que se desliza entre pestañas */}
            <span
              aria-hidden="true"
              className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-xl bg-primary-600 transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ transform: audience === 'doctors' ? 'translateX(100%)' : 'translateX(0)' }}
            />
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
                  aria-controls={active ? `panel-${tab.id}` : undefined}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setAudience(tab.id)}
                  className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 motion-reduce:transition-none ${
                    active ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* key={audience} remonta el panel y reinicia la animación de entrada */}
        <div
          key={audience}
          role="tabpanel"
          id={`panel-${audience}`}
          aria-labelledby={`tab-${audience}`}
          className="panel-in mt-12 space-y-16"
        >
          <div>
            <img
              src={flow.src}
              alt={flow.alt}
              loading="lazy"
              decoding="async"
              className="mx-auto w-full rounded-2xl border border-slate-200 bg-white"
            />
          </div>

          <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <li key={feature.title} className="flex items-start gap-4">
                  <span className="inline-flex flex-none rounded-xl bg-primary-100 p-2.5 text-primary-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{feature.title}</h3>
                    <p className="mt-0.5 text-sm leading-6 text-slate-600">{feature.description}</p>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-2xl font-bold text-slate-900">Preguntas frecuentes</h2>
            <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
              {faqs.map((faq) => (
                <details key={faq.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 [&::-webkit-details-marker]:hidden">
                    {faq.q}
                    <ChevronDown
                      className="h-5 w-5 flex-none text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>

          {/* 4. Cierre: un solo llamado a la acción acorde a la pestaña activa */}
          <div className="rounded-3xl bg-primary-50 px-6 py-10 text-center">
            <h2 className="text-2xl font-bold text-slate-900">{closing.title}</h2>
            <p className="mt-2 text-slate-600">{closing.text}</p>
            <Link to={closing.to} className="btn-primary mt-6 inline-flex">
              {closing.label}
            </Link>
          </div>
        </div>
      </section>

      <style>{ANIMATION_CSS}</style>
    </div>
  )
}