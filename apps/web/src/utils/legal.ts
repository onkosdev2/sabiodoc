/** Metadatos compartidos de los documentos legales. */
export const LEGAL_VERSION = '1.0'
export const LEGAL_UPDATED = '19 de octubre de 2026'

export type LegalStatus = 'pending_legal_review' | 'approved'

/**
 * Estado editorial. Cambiar a `approved` solo después de la revisión formal
 * por asesoría legal. El texto ya está completo y versionado.
 */
export const LEGAL_STATUS: LegalStatus = 'pending_legal_review'
