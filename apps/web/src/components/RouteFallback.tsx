import Spinner from './ui/Spinner'

/** Fallback mientras se carga (lazy) una ruta. */
export default function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Cargando página">
      <Spinner size="lg" />
    </div>
  )
}
