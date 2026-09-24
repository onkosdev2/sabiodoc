const BRAND = 'SabioDoc'
const HOME_TITLE = `${BRAND} - Orientación Médica Inteligente`

const EXACT_TITLES: Record<string, string> = {
  '/specialties': 'Especialidades',
  '/triage': 'Describir mi caso',
  '/guide': 'Guía de especialidades',
  '/emergency': 'Emergencias',
  '/login': 'Iniciar sesión',
  '/register': 'Crear cuenta',
  '/forgot-password': 'Recuperar contraseña',
  '/reset-password': 'Nueva contraseña',
  '/doctor/apply': 'Postular como médico',
  '/notifications': 'Notificaciones',
  '/me/consultations': 'Consultas IA',
  '/me/favorites': 'Mis favoritos',
  '/me/appointments': 'Mis citas',
  '/me/wallet': 'Créditos',
  '/me/history': 'Historial de orientaciones',
  '/me/profile': 'Mi perfil de paciente',
  '/video-room': 'Videoconsulta',
  '/doctor': 'Panel médico',
  '/doctor/pending': 'Solicitud en revisión',
  '/doctor/appointments': 'Citas',
  '/doctor/reviews': 'Reseñas',
  '/doctor/wallet': 'Cartera',
  '/doctor/availability': 'Disponibilidad',
  '/doctor/video-sessions': 'Videoconsultas',
  '/doctor/patients': 'Pacientes',
  '/doctor/profile': 'Perfil profesional',
  '/doctor/notifications': 'Notificaciones',
  '/admin': 'Panel de administración',
  '/admin/overview': 'Resumen',
  '/admin/appointments': 'Citas',
  '/admin/users': 'Usuarios',
  '/admin/reviewers': 'Revisores',
  '/admin/system': 'Estado del sistema',
  '/admin/withdrawals': 'Retiros',
  '/admin/specialties': 'Especialidades',
  '/admin/doctor-applications': 'Postulaciones médicas',
  '/admin/notifications': 'Notificaciones',
  '/reviewer/doctor-applications': 'Postulaciones médicas',
}

const PREFIX_TITLES: Array<[string, string]> = [
  ['/specialties/', 'Especialidad'],
  ['/doctors/', 'Perfil del médico'],
  ['/doctor/patients/', 'Historial del paciente'],
  ['/me/appointments/', 'Reagendar cita'],
  ['/consultation/', 'Consulta IA'],
]

/** Título del documento según la ruta actual (pestañas, historial y SEO). */
export function getDocumentTitle(pathname: string): string {
  if (pathname === '/') return HOME_TITLE

  const exact = EXACT_TITLES[pathname]
  if (exact) return `${exact} · ${BRAND}`

  for (const [prefix, label] of PREFIX_TITLES) {
    if (pathname.startsWith(prefix)) return `${label} · ${BRAND}`
  }

  return BRAND
}
