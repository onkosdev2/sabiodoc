import { ReactNode } from 'react'
import { ClipboardCheck, ShieldCheck, Users } from 'lucide-react'

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
        { to: '/admin/doctor-applications', label: 'Postulaciones médicas', icon: ClipboardCheck },
        { to: '/admin/users', label: 'Usuarios', icon: Users },
      ]}
    >
      {children}
    </PanelLayout>
  )
}
