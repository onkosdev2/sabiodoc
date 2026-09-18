import { Outlet } from 'react-router-dom'
import { Activity, CalendarDays, ClipboardCheck, LayoutDashboard, ShieldCheck, Users } from 'lucide-react'

import PanelLayout from './PanelLayout'

export default function AdminLayout() {
  return (
    <PanelLayout
      panelName="Panel Admin"
      brandIcon={ShieldCheck}
      accent="sky"
      navItems={[
        { to: '/admin/overview', label: 'Panel operativo', icon: LayoutDashboard },
        { to: '/admin/appointments', label: 'Citas', icon: CalendarDays },
        { to: '/admin/doctor-applications', label: 'Postulaciones médicas', icon: ClipboardCheck },
        { to: '/admin/users', label: 'Usuarios', icon: Users },
        { to: '/admin/system', label: 'Estado de la IA', icon: Activity },
      ]}
      notificationsTo="/admin/notifications"
    >
      <Outlet />
    </PanelLayout>
  )
}
