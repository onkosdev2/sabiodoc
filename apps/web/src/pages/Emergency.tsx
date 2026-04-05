import { AlertTriangle, Phone, MapPin } from 'lucide-react'
import BackButton from '../components/BackButton'

export default function Emergency() {
  return (
    <div className="max-w-3xl mx-auto">
      <BackButton />
      
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-red-100 rounded-full">
            <AlertTriangle className="w-10 h-10 text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-red-800">
              Información de Emergencias
            </h1>
            <p className="text-red-600">
              Si tienes una emergencia médica, actúa rápidamente
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            ¿Cuándo acudir a urgencias?
          </h2>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              Dolor en el pecho intenso o dificultad para respirar
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              Signos de derrame cerebral: debilidad en un lado del cuerpo, dificultad para hablar, confusión repentina
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              Sangrado abundante que no se detiene
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              Pérdida de consciencia o desmayo
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              Reacciones alérgicas severas (dificultad para respirar, hinchazón de cara/garganta)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              Convulsiones
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              Lesiones graves por accidentes
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              Fiebre muy alta (especialmente en niños pequeños)
            </li>
          </ul>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <Phone className="w-6 h-6 text-red-600" />
              <h3 className="font-semibold text-gray-800">Números de emergencia</h3>
            </div>
            <ul className="space-y-2 text-gray-700">
              <li><strong>Emergencias:</strong> 911</li>
              <li><strong>Cruz Roja:</strong> Consulta tu número local</li>
              <li><strong>Bomberos:</strong> Consulta tu número local</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <MapPin className="w-6 h-6 text-red-600" />
              <h3 className="font-semibold text-gray-800">Qué hacer</h3>
            </div>
            <ul className="space-y-2 text-gray-700">
              <li>1. Mantén la calma</li>
              <li>2. Llama a emergencias</li>
              <li>3. Sigue las instrucciones del operador</li>
              <li>4. No muevas a la persona si hay lesión de columna</li>
            </ul>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            <strong>Importante:</strong> SabioDoc es una herramienta de orientación y NO puede atender emergencias médicas. 
            Si crees que tienes una emergencia, no uses esta aplicación: llama al número de emergencias de tu país 
            o acude directamente al hospital más cercano.
          </p>
        </div>
      </div>
    </div>
  )
}
