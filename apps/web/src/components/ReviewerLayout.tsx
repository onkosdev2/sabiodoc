import { Outlet } from 'react-router-dom'
import { ClipboardCheck, ShieldCheck } from 'lucide-react'

import PanelLayout from './PanelLayout'

export default function ReviewerLayout() {
  return (
    <PanelLayout
      panelName="Panel de Revisión"
      brandIcon={ShieldCheck}
      accent="violet"
      menuGroups={[[{ to: '/reviewer/doctor-applications', label: 'Postulaciones médicas', icon: ClipboardCheck }]]}
    >
      <Outlet />
    </PanelLayout>
  )
}
