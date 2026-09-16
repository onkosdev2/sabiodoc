import { ReactNode } from 'react'
import { Activity, ClipboardCheck, LayoutDashboard, ShieldCheck, Users } from 'lucide-react'

import PanelLayout from './PanelLayout'

interface AdminLayoutProps {
  children: ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <PanelLayout
      panelName="Panel Admin"
      brandIcon={ShieldCheck}
      accent="sky"
      navItems={[
        { to: '/admin/overview', label: 'Panel operativo', icon: LayoutDashboard },
        { to: '/admin/doctor-applications', label: 'Postulaciones médicas', icon: ClipboardCheck },
        { to: '/admin/users', label: 'Usuarios', icon: Users },
        { to: '/admin/system', label: 'Estado de la IA', icon: Activity },
      ]}
    >
      {children}
    </PanelLayout>
  )
}
