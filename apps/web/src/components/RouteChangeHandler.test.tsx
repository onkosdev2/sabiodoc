import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import RouteChangeHandler from './RouteChangeHandler'

describe('RouteChangeHandler', () => {
  it('actualiza el título y el canonical según la ruta', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/triage']}>
        <RouteChangeHandler />
      </MemoryRouter>,
    )

    await waitFor(() => expect(document.title).toContain('Describir mi caso'))

    const canonical = document.querySelector('link[rel="canonical"]')
    expect(canonical?.getAttribute('href')).toContain('/triage')
  })

  it('usa el título de la marca en la ruta raíz', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/']}>
        <RouteChangeHandler />
      </MemoryRouter>,
    )

    await waitFor(() => expect(document.title).toContain('SabioDoc'))
  })
})
