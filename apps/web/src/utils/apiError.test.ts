import { describe, expect, it } from 'vitest'

import { getApiErrorMessage } from './apiError'

describe('getApiErrorMessage', () => {
  it('devuelve el detalle cuando es un string', () => {
    const error = { response: { status: 400, data: { detail: 'Dato inválido' } } }
    expect(getApiErrorMessage(error)).toBe('Dato inválido')
  })

  it('extrae el mensaje de un error de validación de FastAPI (Pydantic)', () => {
    const error = {
      response: {
        status: 422,
        data: {
          detail: [
            {
              type: 'less_than_equal',
              loc: ['body', 'years_experience'],
              msg: 'Input should be less than or equal to 80',
              input: 999,
              ctx: { le: 80 },
            },
          ],
        },
      },
    }
    expect(getApiErrorMessage(error)).toBe('Input should be less than or equal to 80')
  })

  it('nunca devuelve un objeto (evita romper React al renderizar)', () => {
    const error = {
      response: {
        status: 422,
        data: { detail: [{ type: 'missing', loc: ['body', 'file'], msg: 'Field required' }] },
      },
    }
    const message = getApiErrorMessage(error)
    expect(typeof message).toBe('string')
    expect(message).toBe('Field required')
  })

  it('usa el fallback cuando no hay detalle legible', () => {
    expect(getApiErrorMessage({ response: { status: 500, data: {} } })).toBe(
      'El servidor tuvo un problema. Intenta más tarde.',
    )
    expect(getApiErrorMessage(new Error('boom'), 'Fallback')).toBe(
      'No pudimos conectar con el servidor. Revisa tu conexión.',
    )
  })
})
