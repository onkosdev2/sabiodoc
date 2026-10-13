import { Outlet } from 'react-router-dom'
import { Inbox, LifeBuoy, Lock, Users } from 'lucide-react'

import PanelLayout from './PanelLayout'

export default function SupportLayout() {
  return (
    <PanelLayout
      panelName="Panel de Soporte"
      brandIcon={LifeBuoy}
      accent="amber"
      menuGroups={[
        [{ to: '/support/tickets', label: 'Tickets', icon: Inbox }],
        [{ to: '/support/users', label: 'Usuarios', icon: Users }],
        [{ to: '/support/security', label: 'Seguridad', icon: Lock }],
      ]}
      notificationsTo="/support/notifications"
    >
      <Outlet />
    </PanelLayout>
  )
}
