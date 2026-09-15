import { ReactNode } from 'react'
import { ClipboardCheck, ShieldCheck } from 'lucide-react'

import PanelLayout from './PanelLayout'

interface ReviewerLayoutProps {
  children: ReactNode
}

export default function ReviewerLayout({ children }: ReviewerLayoutProps) {
  return (
    <PanelLayout
      panelName="Panel de Revisión"
      brandIcon={ShieldCheck}
      accent="violet"
      navItems={[
        { to: '/reviewer/doctor-applications', label: 'Postulaciones médicas', icon: ClipboardCheck },
      ]}
    >
      {children}
    </PanelLayout>
  )
}
