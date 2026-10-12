import { describe, it, expect } from 'vitest'

import { getNotificationMeta, resolveNotificationCategory } from './notificationMeta'

describe('resolveNotificationCategory', () => {
  it('mapea los tipos conocidos a su categoría', () => {
    expect(resolveNotificationCategory('appointment_booked')).toBe('appointments')
    expect(resolveNotificationCategory('appointment_rescheduled')).toBe('appointments')
    expect(resolveNotificationCategory('appointment_reminder_hour')).toBe('reminders')
    expect(resolveNotificationCategory('appointment_cancelled')).toBe('cancellations')
    expect(resolveNotificationCategory('appointment_no_show')).toBe('cancellations')
    expect(resolveNotificationCategory('video_session_no_credits')).toBe('credits')
    expect(resolveNotificationCategory('video_consultation_completed')).toBe('video')
    expect(resolveNotificationCategory('doctor_application_reviewed')).toBe('profile')
    expect(resolveNotificationCategory('patient_profile_change_request')).toBe('profile')
    expect(resolveNotificationCategory('appointment_review')).toBe('reviews')
    expect(resolveNotificationCategory('appointment_file_received')).toBe('files')
  })

  it('infiere la categoría por prefijo para tipos nuevos', () => {
    expect(resolveNotificationCategory('appointment_whatever')).toBe('appointments')
    expect(resolveNotificationCategory('appointment_reminder_week')).toBe('reminders')
    expect(resolveNotificationCategory('video_session_prepared')).toBe('video')
    expect(resolveNotificationCategory('doctor_application_submitted')).toBe('profile')
    expect(resolveNotificationCategory('new_credit_purchase')).toBe('credits')
    expect(resolveNotificationCategory('some_file_uploaded')).toBe('files')
  })

  it('usa "system" para tipos desconocidos', () => {
    expect(resolveNotificationCategory('totally_unknown')).toBe('system')
  })
})

describe('getNotificationMeta', () => {
  it('devuelve etiqueta, icono y clases de la categoría', () => {
    const meta = getNotificationMeta('appointment_booked')
    expect(meta.id).toBe('appointments')
    expect(meta.label).toBe('Citas')
    expect(meta.chipClass).toContain('bg-blue')
    expect(meta.accentClass).toContain('bg-blue')
    expect(meta.icon).toBeTruthy()
  })

  it('cae a la categoría de sistema si no se reconoce el tipo', () => {
    const meta = getNotificationMeta('???')
    expect(meta.id).toBe('system')
    expect(meta.label).toBe('Sistema')
  })
})
