import { describe, expect, it } from 'vitest'

import { classifyMediaError } from './media'

describe('classifyMediaError', () => {
  it('distingue permiso denegado, dispositivo ausente, ocupado y timeout', () => {
    expect(classifyMediaError({ name: 'NotAllowedError' }).status).toBe('denied')
    expect(classifyMediaError({ name: 'NotFoundError' }).status).toBe('not-found')
    expect(classifyMediaError({ name: 'NotReadableError' }).status).toBe('busy')
    expect(classifyMediaError({ name: 'TimeoutError' }).status).toBe('timeout')
    expect(classifyMediaError({ name: 'OverconstrainedError' }).status).toBe('overconstrained')
    expect(classifyMediaError(new Error('otro')).status).toBe('error')
  })
})
