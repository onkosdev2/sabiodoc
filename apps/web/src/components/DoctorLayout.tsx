import { ReactNode } from 'react'
import { Activity, Briefcase, CalendarDays, FileText } from 'lucide-react'

import PanelLayout, { PanelNavItem } from './PanelLayout'
import { useAuth } from '../context/AuthContext'

interface DoctorLayoutProps {
  children: ReactNode
}

export default function DoctorLayout({ children }: DoctorLayoutProps) {
  const { user } = useAuth()
  const isApproved = user?.doctor_status === 'approved'

  // Un medico sin aprobar no puede entrar a las rutas clinicas: le mostramos
  // solo la opcion de completar su postulacion.
  const navItems: PanelNavItem[] = isApproved
    ? [
        { to: '/doctor', label: 'Dashboard', icon: CalendarDays },
        { to: '/doctor/video-sessions', label: 'Videoconsultas', icon: Activity },
        { to: '/doctor/availability', label: 'Disponibilidad', icon: CalendarDays },
        { to: '/doctor/profile', label: 'Perfil médico', icon: FileText },
      ]
    : [{ to: '/doctor/apply', label: 'Mi postulación', icon: FileText }]

  return (
    <PanelLayout
      panelName="Panel Médico"
      brandIcon={Briefcase}
      accent="emerald"
      navItems={navItems}
      notificationsTo={isApproved ? '/doctor/notifications' : '/notifications'}
    >
      {children}
    </PanelLayout>
  )
}
