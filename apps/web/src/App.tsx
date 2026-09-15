import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import GeneralLayout from './components/GeneralLayout'
import DoctorLayout from './components/DoctorLayout'
import AdminLayout from './components/AdminLayout'
import ReviewerLayout from './components/ReviewerLayout'
import AuthenticatedRoute from './components/guards/AuthenticatedRoute'
import DoctorRoute from './components/guards/DoctorRoute'
import PatientRoute from './components/guards/PatientRoute'
import AdminRoute from './components/guards/AdminRoute'
import ReviewerRoute from './components/guards/ReviewerRoute'
import Home from './pages/Home'
import Specialties from './pages/Specialties'
import SpecialtyDetail from './pages/SpecialtyDetail'
import Triage from './pages/Triage'
import Guide from './pages/Guide'
import MyConsultations from './pages/MyConsultations'
import MyFavorites from './pages/MyFavorites'
import Emergency from './pages/Emergency'
import Login from './pages/Login'
import Register from './pages/Register'
import DoctorOnboarding from './pages/DoctorOnboarding'
import AdminDoctorApplications from './pages/AdminDoctorApplications'
import AdminUsers from './pages/AdminUsers'
import ReviewerDoctorApplications from './pages/ReviewerDoctorApplications'
import ConsultationChat from './pages/ConsultationChat'
import VideoConsultationRoom from './pages/VideoConsultationRoom'
import DoctorVideoSessions from './pages/DoctorVideoSessions'
import DoctorPending from './pages/DoctorPending'
import DoctorDashboard from './pages/DoctorDashboard'
import DoctorAvailability from './pages/DoctorAvailability'
import DoctorPatientTimeline from './pages/DoctorPatientTimeline'
import NotificationsPage from './pages/NotificationsPage'
import MyAppointments from './pages/MyAppointments'
import BookAppointment from './pages/BookAppointment'
import RescheduleAppointment from './pages/RescheduleAppointment'
import ConsultationHistory from './pages/ConsultationHistory'

function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <Routes>
        <Route element={<GeneralLayout><Home /></GeneralLayout>} path="/" />
        <Route element={<GeneralLayout><Specialties /></GeneralLayout>} path="/specialties" />
        <Route element={<GeneralLayout><SpecialtyDetail /></GeneralLayout>} path="/specialties/:slug" />
        <Route element={<GeneralLayout><Triage /></GeneralLayout>} path="/triage" />
        <Route element={<GeneralLayout><Guide /></GeneralLayout>} path="/guide" />
        <Route element={<GeneralLayout><Emergency /></GeneralLayout>} path="/emergency" />
        <Route element={<GeneralLayout><Login /></GeneralLayout>} path="/login" />
        <Route element={<GeneralLayout><Register /></GeneralLayout>} path="/register" />
        <Route element={<GeneralLayout><DoctorOnboarding /></GeneralLayout>} path="/doctor/apply" />

        <Route element={<PatientRoute />}>
          <Route element={<GeneralLayout><MyConsultations /></GeneralLayout>} path="/me/consultations" />
          <Route element={<GeneralLayout><MyFavorites /></GeneralLayout>} path="/me/favorites" />
          <Route element={<GeneralLayout><MyAppointments /></GeneralLayout>} path="/me/appointments" />
          <Route element={<GeneralLayout><RescheduleAppointment /></GeneralLayout>} path="/me/appointments/:appointmentId/reschedule" />
          <Route element={<GeneralLayout><ConsultationChat /></GeneralLayout>} path="/consultation/:id/chat" />
          <Route element={<GeneralLayout><BookAppointment /></GeneralLayout>} path="/consultation/:consultationId/book" />
        </Route>

        <Route element={<AuthenticatedRoute />}>
          <Route path="/video-room" element={<VideoConsultationRoom />} />
          <Route path="/notifications" element={<GeneralLayout><NotificationsPage /></GeneralLayout>} />
          <Route element={<GeneralLayout><ConsultationHistory /></GeneralLayout>} path="/me/history" />
        </Route>

        <Route path="/doctor/pending" element={<DoctorLayout><DoctorPending /></DoctorLayout>} />
        <Route element={<DoctorRoute />}>
          <Route path="/doctor" element={<DoctorLayout><DoctorDashboard /></DoctorLayout>} />
          <Route path="/doctor/availability" element={<DoctorLayout><DoctorAvailability /></DoctorLayout>} />
          <Route path="/doctor/video-sessions" element={<DoctorLayout><DoctorVideoSessions /></DoctorLayout>} />
          <Route path="/doctor/patients/:patientId" element={<DoctorLayout><DoctorPatientTimeline /></DoctorLayout>} />
          <Route path="/doctor/profile" element={<DoctorLayout><DoctorOnboarding /></DoctorLayout>} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminLayout><Navigate to="/admin/doctor-applications" replace /></AdminLayout>} />
          <Route path="/admin/doctor-applications" element={<AdminLayout><AdminDoctorApplications /></AdminLayout>} />
          <Route path="/admin/reviewers" element={<AdminLayout><AdminUsers /></AdminLayout>} />
          <Route path="/admin/users" element={<AdminLayout><AdminUsers /></AdminLayout>} />
        </Route>

        <Route element={<ReviewerRoute />}>
          <Route path="/reviewer" element={<Navigate to="/reviewer/doctor-applications" replace />} />
          <Route path="/reviewer/doctor-applications" element={<ReviewerLayout><ReviewerDoctorApplications /></ReviewerLayout>} />
        </Route>
        </Routes>
      </NotificationsProvider>
    </AuthProvider>
  )
}

export default App
