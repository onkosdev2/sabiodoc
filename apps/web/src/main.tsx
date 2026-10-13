import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './context/ToastContext'
import { reportClientError } from './utils/clientErrorReporter'
import './index.css'

// Captura global de errores que no pasan por el ErrorBoundary (async, eventos).
window.addEventListener('error', (event) => {
  if (!event.error && !event.message) return
  reportClientError({
    message: event.message || 'Error no controlado en el navegador',
    error: event.error,
    context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
  })
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as { message?: string } | undefined
  reportClientError({
    message: reason?.message || String(event.reason ?? 'Promesa rechazada sin manejar'),
    error: event.reason,
    errorType: 'UnhandledRejection',
  })
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
)
