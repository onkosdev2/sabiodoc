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
            <strong>Importante:</strong> SabioDoc es una
            herramienta de orientación y NO puede atender emergencias médicas.
            Si crees que tienes una emergencia, no uses esta aplicación: llama al número de emergencias de tu país
            o acude directamente al hospital más cercano.
          </p>
        </div>
      </div>
    </div>
  )
}





/*import { useState } from 'react'
import { AlertTriangle, Phone, MapPin, Search, Loader2, Navigation, ExternalLink, Cross, Shield } from 'lucide-react'
import BackButton from '../components/BackButton'

interface HospitalItem {
  name: string
  address: string
  google_maps_query: string
}

interface EmergencyData {
  emergencias_medicas: string
  cruz_roja_o_ambulancia: string
  bomberos: string
  policia: string
  region: string
  hospitals: HospitalItem[]
}

export default function Emergency() {
  const [address, setAddress] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mapUrl, setMapUrl] = useState('')
  const [data, setData] = useState<EmergencyData>({
    emergencias_medicas: '106 (SAMU) / 911',
    cruz_roja_o_ambulancia: '01 266 0481 (Cruz Roja)',
    bomberos: '116',
    policia: '105',
    region: '',
    hospitals: []
  })

  const fetchEmergencyData = async (userLocation: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('http://localhost:8000/emergency/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: userLocation }),
      })

      if (!res.ok) throw new Error('Error al conectar con la API')

      const result: EmergencyData = await res.json()
      setData(result)

      // Definir destino inicial del mapa (el primer hospital sugerido o genérico)
      const targetHospital = result.hospitals[0]?.google_maps_query || 'hospital de urgencias'
      updateMapRoute(userLocation, targetHospital)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateMapRoute = (origin: string, destination: string) => {
    const saddr = encodeURIComponent(origin)
    const daddr = encodeURIComponent(destination)
    setMapUrl(`https://www.google.com/maps?saddr=${saddr}&daddr=${daddr}&output=embed`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!address.trim()) return
    fetchEmergencyData(address)
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return
    setIsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = `${pos.coords.latitude}, ${pos.coords.longitude}`
        setAddress(coords)
        fetchEmergencyData(coords)
      },
      () => setIsLoading(false)
    )
  }

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <BackButton />

      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 sm:p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-red-100 rounded-full">
            <AlertTriangle className="w-10 h-10 text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-red-800">Información de Emergencias</h1>
            <p className="text-red-600">Si tienes una emergencia médica, actúa rápidamente</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-5 mb-6 shadow-sm border border-red-100">
          <label className="block text-gray-800 font-semibold mb-2">
            Ingresa tu ubicación (Distrito, Ciudad o Coordenadas)
          </label>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Ej. Miraflores, Lima o Av. Javier Prado Este..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-800"
              />
              <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
            </div>

            <button
              type="submit"
              disabled={isLoading || !address.trim()}
              className="bg-red-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              Buscar
            </button>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLoading}
              title="Detectar por GPS"
              className="border border-gray-300 hover:bg-gray-100 px-3 py-2 rounded-lg text-gray-700 transition flex items-center justify-center"
            >
              <Navigation className="w-5 h-5" />
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg p-5 mb-6 shadow-sm border border-red-100">
          <div className="flex items-center justify-between mb-3 border-b pb-2">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-gray-800 text-lg">Centrales de Emergencia</h3>
            </div>
            {data.region && (
              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full">
                {data.region}
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-red-50/50 rounded-lg border border-red-100">
              <span className="text-xs text-red-600 font-bold uppercase tracking-wider block mb-1">
                Emergencias Médicas / Salud
              </span>
              <a href={`tel:${data.emergencias_medicas}`} className="text-base font-bold text-red-700 hover:underline">
                {data.emergencias_medicas}
              </a>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">
                Ambulancia / Cruz Roja
              </span>
              <a href={`tel:${data.cruz_roja_o_ambulancia}`} className="text-base font-bold text-gray-800 hover:underline">
                {data.cruz_roja_o_ambulancia}
              </a>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">
                Bomberos (Rescate Médico)
              </span>
              <a href={`tel:${data.bomberos}`} className="text-base font-bold text-gray-800 hover:underline">
                {data.bomberos}
              </a>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-blue-600" /> Policía Nacional
              </span>
              <a href={`tel:${data.policia}`} className="text-base font-bold text-gray-800 hover:underline">
                {data.policia}
              </a>
            </div>
          </div>
        </div>

        {data.hospitals.length > 0 && (
          <div className="bg-white rounded-lg p-5 mb-6 shadow-sm border border-red-100">
            <div className="flex items-center gap-2 mb-3">
              <Cross className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-gray-800">Hospitales con urgencias cercanos</h3>
            </div>
            <div className="space-y-2">
              {data.hospitals.map((hosp, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg hover:border-red-300 transition gap-2"
                >
                  <div>
                    <p className="font-semibold text-gray-800">{hosp.name}</p>
                    <p className="text-xs text-gray-500">{hosp.address}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateMapRoute(address, hosp.google_maps_query)}
                      className="text-xs bg-red-50 text-red-700 hover:bg-red-100 font-medium px-3 py-1.5 rounded transition"
                    >
                      Ver ruta en mapa
                    </button>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hosp.google_maps_query)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-500 hover:text-red-600"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mapUrl && (
          <div className="bg-white rounded-lg p-4 mb-6 shadow-sm border border-red-100">
            <h3 className="font-semibold text-gray-800 mb-2">Ruta de emergencia en tiempo real</h3>
            <div className="h-80 w-full rounded-lg overflow-hidden border border-gray-200">
              <iframe
                title="Ruta de emergencia"
                src={mapUrl}
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            <strong>Importante:</strong> SabioDoc es una herramienta de orientación y NO puede atender emergencias médicas.
            Si crees que tienes una emergencia grave, llama de inmediato a la central médica o dirígete a urgencias.
          </p>
        </div>
      </div>
    </div>
  )
}
*/