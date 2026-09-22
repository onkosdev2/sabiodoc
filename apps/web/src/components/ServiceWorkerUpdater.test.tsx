import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import ServiceWorkerUpdater from './ServiceWorkerUpdater'

describe('ServiceWorkerUpdater', () => {
  it('no renderiza nada si no hay una actualización disponible', () => {
    // En el entorno de test no hay service worker ni build de producción.
    const { container } = render(<ServiceWorkerUpdater />)
    expect(container).toBeEmptyDOMElement()
  })
})
