import { Outlet } from 'react-router-dom'
import { Activity, Briefcase, CalendarDays, FileText, Star, Users, Wallet } from 'lucide-react'

import PanelLayout, { PanelNavItem } from './PanelLayout'
import { useAuth } from '../context/AuthContext'

export default function DoctorLayout() {
  const { user } = useAuth()
  const isApproved = user?.doctor_status === 'approved'

  // Un medico sin aprobar no puede entrar a las rutas clinicas: le mostramos
  // solo la opcion de completar su postulacion.
  const menuGroups: PanelNavItem[][] = isApproved
    ? [
        // Operación clínica diaria.
        [
          { to: '/doctor', label: 'Panel operativo', icon: CalendarDays },
          { to: '/doctor/appointments', label: 'Citas', icon: CalendarDays },
          { to: '/doctor/patients', label: 'Mis pacientes', icon: Users },
          { to: '/doctor/video-sessions', label: 'Videoconsultas', icon: Activity },
        ],
        // Gestión periódica.
        [
          { to: '/doctor/availability', label: 'Disponibilidad', icon: CalendarDays },
          { to: '/doctor/reviews', label: 'Valoraciones', icon: Star },
        ],
        // Finanzas.
        [{ to: '/doctor/wallet', label: 'Ingresos', icon: Wallet }],
        // Cuenta.
        [{ to: '/doctor/profile', label: 'Mi perfil profesional', icon: FileText }],
      ]
    : [[{ to: '/doctor/apply', label: 'Mi postulación', icon: FileText }]]

  return (
    <PanelLayout
      panelName="Panel Médico"
      brandIcon={Briefcase}
      accent="emerald"
      menuGroups={menuGroups}
      notificationsTo={isApproved ? '/doctor/notifications' : '/notifications'}
    >
      <Outlet />
    </PanelLayout>
  )
}
