import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

import Button from './ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/** Captura errores de render y muestra un fallback en vez de una pantalla en blanco. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no controlado:', error, info)
  }

  private handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="card max-w-md text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Algo salió mal</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ocurrió un error inesperado. Puedes reintentar o recargar la página.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="secondary" onClick={this.handleRetry}>
              Reintentar
            </Button>
            <Button onClick={() => window.location.reload()}>Recargar</Button>
          </div>
        </div>
      </div>
    )
  }
}
