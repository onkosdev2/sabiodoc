import { Outlet } from 'react-router-dom'
import { Activity, Bug, CalendarDays, ClipboardCheck, Flag, Landmark, LayoutDashboard, ShieldCheck, Stethoscope, Users } from 'lucide-react'

import PanelLayout from './PanelLayout'

export default function AdminLayout() {
  return (
    <PanelLayout
      panelName="Panel Admin"
      brandIcon={ShieldCheck}
      accent="sky"
      menuGroups={[
        // Operación y gestión.
        [
          { to: '/admin/overview', label: 'Panel operativo', icon: LayoutDashboard },
          { to: '/admin/doctor-applications', label: 'Postulaciones médicas', icon: ClipboardCheck },
          { to: '/admin/users', label: 'Usuarios', icon: Users },
          { to: '/admin/specialties', label: 'Especialidades', icon: Stethoscope },
          { to: '/admin/reviews', label: 'Reseñas', icon: Flag },
          { to: '/admin/finance', label: 'Ingresos y salidas', icon: Landmark },
        ],
        // Supervisión y monitoreo.
        [
          { to: '/admin/appointments', label: 'Citas', icon: CalendarDays },
          { to: '/admin/system', label: 'Estado de la IA', icon: Activity },
          { to: '/admin/errors', label: 'Errores del sistema', icon: Bug },
        ],
        // Cuenta.
        [{ to: '/admin/security', label: 'Seguridad', icon: ShieldCheck }],
      ]}
      notificationsTo="/admin/notifications"
    >
      <Outlet />
    </PanelLayout>
  )
}
