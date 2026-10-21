import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import CountrySelect from './CountrySelect'

const COUNTRIES = [
  { isoCode: 'PE', name: 'Peru' },
  { isoCode: 'CO', name: 'Colombia' },
]

describe('CountrySelect', () => {
  it('encuentra un país por nombre localizado', async () => {
    const onChange = vi.fn()
    render(<CountrySelect value="" onChange={onChange} countries={COUNTRIES} />)

    await userEvent.type(screen.getByLabelText(/País/), 'Perú')
    expect(onChange).toHaveBeenCalledWith('PE')
  })

  it('encuentra un país por código ISO', async () => {
    const onChange = vi.fn()
    render(<CountrySelect value="" onChange={onChange} countries={COUNTRIES} />)

    await userEvent.type(screen.getByLabelText(/País/), 'CO')
    expect(onChange).toHaveBeenCalledWith('CO')
  })
})
