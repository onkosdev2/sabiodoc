import { describe, expect, it } from 'vitest'

import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_TRANSACTION_STATUS_LABELS,
  VIDEO_SESSION_STATUS_LABELS,
} from './statusLabels'

describe('etiquetas de estado en español', () => {
  it('traduce todos los estados de cobro', () => {
    expect(PAYMENT_STATUS_LABELS.cancelled).toBe('Cancelado')
    expect(PAYMENT_STATUS_LABELS.pending).toBe('Pendiente de cobro')
    expect(PAYMENT_STATUS_LABELS.paid).toBe('Cobrado')
    expect(PAYMENT_STATUS_LABELS.failed).toBe('Rechazado')
  })

  it('traduce los estados de transacciones de pago', () => {
    expect(PAYMENT_TRANSACTION_STATUS_LABELS.processing).toBe('Procesando')
    expect(PAYMENT_TRANSACTION_STATUS_LABELS.succeeded).toBe('Aprobado')
    expect(PAYMENT_TRANSACTION_STATUS_LABELS.requires_action).toBe('Requiere verificación')
    expect(PAYMENT_TRANSACTION_STATUS_LABELS.cancelled).toBe('Cancelado')
  })

  it('incluye los estados de ampliación de videoconsulta', () => {
    expect(VIDEO_SESSION_STATUS_LABELS.extension_pending).toBe('Tiempo agotado')
    expect(VIDEO_SESSION_STATUS_LABELS.extension_requested).toBe('Ampliación por confirmar')
  })
})
