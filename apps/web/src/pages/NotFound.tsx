import { Link } from 'react-router-dom'
import { Compass, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <Compass className="mx-auto mb-4 h-12 w-12 text-slate-300" aria-hidden="true" />
      <h1 className="text-2xl font-bold text-slate-900">Página no encontrada</h1>
      <p className="mt-2 text-slate-500">La página que buscas no existe o cambió de dirección.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primary">
          <Home className="h-4 w-4" aria-hidden="true" />
          Ir al inicio
        </Link>
        <Link to="/specialties" className="btn-secondary">
          Ver especialidades
        </Link>
      </div>
    </div>
  )
}
