import { AlertTriangle, MapPin, Phone } from 'lucide-react'

import BackButton from '../components/BackButton'
import Alert from '../components/ui/Alert'
import Card from '../components/ui/Card'

const WHEN_TO_GO = [
  'Dolor en el pecho intenso o dificultad para respirar',
  'Signos de derrame cerebral: debilidad en un lado del cuerpo, dificultad para hablar, confusión repentina',
  'Sangrado abundante que no se detiene',
  'Pérdida de consciencia o desmayo',
  'Reacciones alérgicas severas (dificultad para respirar, hinchazón de cara o garganta)',
  'Convulsiones',
  'Lesiones graves por accidentes',
  'Fiebre muy alta (especialmente en niños pequeños)',
]

const WHAT_TO_DO = [
  'Mantén la calma',
  'Llama a emergencias',
  'Sigue las instrucciones del operador',
  'No muevas a la persona si sospechas una lesión de columna',
]

export default function Emergency() {
  return (
    <div className="mx-auto max-w-3xl">
      <BackButton />

      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-full bg-red-100 p-3">
            <AlertTriangle className="h-10 w-10 text-red-600" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-red-800">Información de emergencias</h1>
            <p className="text-red-600">Si tienes una emergencia médica, actúa rápidamente</p>
          </div>
        </div>

        <Card className="mb-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">¿Cuándo acudir a urgencias?</h2>
          <ul className="space-y-3 text-slate-700">
            {WHEN_TO_GO.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <Phone className="h-6 w-6 text-red-600" aria-hidden="true" />
              <h3 className="font-semibold text-slate-800">Números de emergencia</h3>
            </div>
            <ul className="space-y-2 text-slate-700">
              <li>
                <strong>Emergencias:</strong>{' '}
                <a href="tel:911" className="font-medium text-red-700 hover:underline">
                  911
                </a>
              </li>
              <li>
                <strong>Cruz Roja:</strong> Consulta tu número local
              </li>
              <li>
                <strong>Bomberos:</strong> Consulta tu número local
              </li>
            </ul>
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-3">
              <MapPin className="h-6 w-6 text-red-600" aria-hidden="true" />
              <h3 className="font-semibold text-slate-800">Qué hacer</h3>
            </div>
            <ol className="space-y-2 text-slate-700">
              {WHAT_TO_DO.map((item, index) => (
                <li key={item} className="flex gap-2">
                  <span className="font-semibold text-red-600">{index + 1}.</span>
                  {item}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Alert tone="warning" title="Importante">
          SabioDoc es una herramienta de orientación y <strong>no puede atender emergencias médicas</strong>. Si crees
          que tienes una emergencia, no uses esta aplicación: llama al número de emergencias de tu país o acude
          directamente al hospital más cercano.
        </Alert>
      </div>
    </div>
  )
}
