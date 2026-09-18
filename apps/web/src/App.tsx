import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import GeneralLayout from './components/GeneralLayout'
import DoctorLayout from './components/DoctorLayout'
import AdminLayout from './components/AdminLayout'
import ReviewerLayout from './components/ReviewerLayout'
import RouteFallback from './components/RouteFallback'
import AuthenticatedRoute from './components/guards/AuthenticatedRoute'
import DoctorRoute from './components/guards/DoctorRoute'
import PatientRoute from './components/guards/PatientRoute'
import AdminRoute from './components/guards/AdminRoute'
import ReviewerRoute from './components/guards/ReviewerRoute'
import NotFound from './pages/NotFound'

// Páginas con carga diferida (code-splitting por ruta).
const Home = lazy(() => import('./pages/Home'))
const Specialties = lazy(() => import('./pages/Specialties'))
const SpecialtyDetail = lazy(() => import('./pages/SpecialtyDetail'))
const DoctorDetailPage = lazy(() => import('./pages/DoctorDetail'))
const Triage = lazy(() => import('./pages/Triage'))
const Guide = lazy(() => import('./pages/Guide'))
const MyConsultations = lazy(() => import('./pages/MyConsultations'))
const MyFavorites = lazy(() => import('./pages/MyFavorites'))
const Emergency = lazy(() => import('./pages/Emergency'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const DoctorOnboarding = lazy(() => import('./pages/DoctorOnboarding'))
const AdminDoctorApplications = lazy(() => import('./pages/AdminDoctorApplications'))
const AdminOverview = lazy(() => import('./pages/AdminOverview'))
const AdminAppointments = lazy(() => import('./pages/AdminAppointments'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
const AdminSystemHealth = lazy(() => import('./pages/AdminSystemHealth'))
const ReviewerDoctorApplications = lazy(() => import('./pages/ReviewerDoctorApplications'))
const ConsultationChat = lazy(() => import('./pages/ConsultationChat'))
const VideoConsultationRoom = lazy(() => import('./pages/VideoConsultationRoom'))
const DoctorVideoSessions = lazy(() => import('./pages/DoctorVideoSessions'))
const DoctorPending = lazy(() => import('./pages/DoctorPending'))
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'))
const DoctorAppointments = lazy(() => import('./pages/DoctorAppointments'))
const DoctorReviews = lazy(() => import('./pages/DoctorReviews'))
const DoctorAvailability = lazy(() => import('./pages/DoctorAvailability'))
const DoctorPatientTimeline = lazy(() => import('./pages/DoctorPatientTimeline'))
const DoctorPatients = lazy(() => import('./pages/DoctorPatients'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const MyAppointments = lazy(() => import('./pages/MyAppointments'))
const RescheduleAppointment = lazy(() => import('./pages/RescheduleAppointment'))
const ConsultationHistory = lazy(() => import('./pages/ConsultationHistory'))
const PatientProfilePage = lazy(() => import('./pages/PatientProfile'))

function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Portal general (paciente + páginas públicas) */}
            <Route element={<GeneralLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/specialties" element={<Specialties />} />
              <Route path="/specialties/:slug" element={<SpecialtyDetail />} />
              <Route path="/doctors/:doctorId" element={<DoctorDetailPage />} />
              <Route path="/triage" element={<Triage />} />
              <Route path="/guide" element={<Guide />} />
              <Route path="/emergency" element={<Emergency />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/doctor/apply" element={<DoctorOnboarding />} />

              <Route element={<PatientRoute />}>
                <Route path="/me/consultations" element={<MyConsultations />} />
                <Route path="/me/favorites" element={<MyFavorites />} />
                <Route path="/me/appointments" element={<MyAppointments />} />
                <Route path="/me/appointments/:appointmentId/reschedule" element={<RescheduleAppointment />} />
                <Route path="/consultation/:id/chat" element={<ConsultationChat />} />
              </Route>

              <Route element={<AuthenticatedRoute />}>
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/me/history" element={<ConsultationHistory />} />
                <Route path="/me/profile" element={<PatientProfilePage />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Route>

            {/* Sala de videoconsulta (layout propio, sin cabecera general) */}
            <Route element={<AuthenticatedRoute />}>
              <Route path="/video-room" element={<VideoConsultationRoom />} />
            </Route>

            {/* Panel médico */}
            <Route element={<DoctorLayout />}>
              <Route path="/doctor/pending" element={<DoctorPending />} />
              <Route element={<DoctorRoute />}>
                <Route path="/doctor" element={<DoctorDashboard />} />
                <Route path="/doctor/appointments" element={<DoctorAppointments />} />
                <Route path="/doctor/reviews" element={<DoctorReviews />} />
                <Route path="/doctor/availability" element={<DoctorAvailability />} />
                <Route path="/doctor/video-sessions" element={<DoctorVideoSessions />} />
                <Route path="/doctor/patients" element={<DoctorPatients />} />
                <Route path="/doctor/patients/:patientId" element={<DoctorPatientTimeline />} />
                <Route path="/doctor/profile" element={<DoctorOnboarding />} />
                <Route path="/doctor/notifications" element={<NotificationsPage />} />
              </Route>
            </Route>

            {/* Panel de administración */}
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
                <Route path="/admin/overview" element={<AdminOverview />} />
                <Route path="/admin/appointments" element={<AdminAppointments />} />
                <Route path="/admin/doctor-applications" element={<AdminDoctorApplications />} />
                <Route path="/admin/reviewers" element={<AdminUsers />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/system" element={<AdminSystemHealth />} />
                <Route path="/admin/notifications" element={<NotificationsPage />} />
              </Route>
            </Route>

            {/* Panel de revisión */}
            <Route element={<ReviewerRoute />}>
              <Route element={<ReviewerLayout />}>
                <Route path="/reviewer" element={<Navigate to="/reviewer/doctor-applications" replace />} />
                <Route path="/reviewer/doctor-applications" element={<ReviewerDoctorApplications />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </NotificationsProvider>
    </AuthProvider>
  )
}

export default App
