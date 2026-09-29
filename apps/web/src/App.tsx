import { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { lazyWithRetry } from './utils/lazyWithRetry'
import GeneralLayout from './components/GeneralLayout'
import RouteChangeHandler from './components/RouteChangeHandler'
import ServiceWorkerUpdater from './components/ServiceWorkerUpdater'
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
const Home = lazyWithRetry(() => import('./pages/Home'))
const Specialties = lazyWithRetry(() => import('./pages/Specialties'))
const SpecialtyDetail = lazyWithRetry(() => import('./pages/SpecialtyDetail'))
const DoctorDetailPage = lazyWithRetry(() => import('./pages/DoctorDetail'))
const Triage = lazyWithRetry(() => import('./pages/Triage'))
const Guide = lazyWithRetry(() => import('./pages/Guide'))
const MyConsultations = lazyWithRetry(() => import('./pages/MyConsultations'))
const MyFavorites = lazyWithRetry(() => import('./pages/MyFavorites'))
const Emergency = lazyWithRetry(() => import('./pages/Emergency'))
const Login = lazyWithRetry(() => import('./pages/Login'))
const Register = lazyWithRetry(() => import('./pages/Register'))
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'))
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'))
const DoctorOnboarding = lazyWithRetry(() => import('./pages/DoctorOnboarding'))
const AdminDoctorApplications = lazyWithRetry(() => import('./pages/AdminDoctorApplications'))
const AdminOverview = lazyWithRetry(() => import('./pages/AdminOverview'))
const AdminAppointments = lazyWithRetry(() => import('./pages/AdminAppointments'))
const AdminUsers = lazyWithRetry(() => import('./pages/AdminUsers'))
const AdminSystemHealth = lazyWithRetry(() => import('./pages/AdminSystemHealth'))
const ReviewerDoctorApplications = lazyWithRetry(() => import('./pages/ReviewerDoctorApplications'))
const ConsultationChat = lazyWithRetry(() => import('./pages/ConsultationChat'))
const VideoConsultationRoom = lazyWithRetry(() => import('./pages/VideoConsultationRoom'))
const DoctorVideoSessions = lazyWithRetry(() => import('./pages/DoctorVideoSessions'))
const DoctorPending = lazyWithRetry(() => import('./pages/DoctorPending'))
const DoctorDashboard = lazyWithRetry(() => import('./pages/DoctorDashboard'))
const DoctorAppointments = lazyWithRetry(() => import('./pages/DoctorAppointments'))
const DoctorReviews = lazyWithRetry(() => import('./pages/DoctorReviews'))
const DoctorAvailability = lazyWithRetry(() => import('./pages/DoctorAvailability'))
const DoctorPatientTimeline = lazyWithRetry(() => import('./pages/DoctorPatientTimeline'))
const DoctorPatients = lazyWithRetry(() => import('./pages/DoctorPatients'))
const NotificationsPage = lazyWithRetry(() => import('./pages/NotificationsPage'))
const MyAppointments = lazyWithRetry(() => import('./pages/MyAppointments'))
const RescheduleAppointment = lazyWithRetry(() => import('./pages/RescheduleAppointment'))
const ConsultationHistory = lazyWithRetry(() => import('./pages/ConsultationHistory'))
const PatientProfilePage = lazyWithRetry(() => import('./pages/PatientProfile'))
const WalletPage = lazyWithRetry(() => import('./pages/Wallet'))
const AdminWithdrawals = lazyWithRetry(() => import('./pages/AdminWithdrawals'))
const AdminSpecialties = lazyWithRetry(() => import('./pages/AdminSpecialties'))

function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <RouteChangeHandler />
        <ServiceWorkerUpdater />
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
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/doctor/apply" element={<DoctorOnboarding />} />

              <Route element={<PatientRoute />}>
                <Route path="/me/consultations" element={<MyConsultations />} />
                <Route path="/me/favorites" element={<MyFavorites />} />
                <Route path="/me/appointments" element={<MyAppointments />} />
                <Route path="/me/wallet" element={<WalletPage audience="patient" />} />
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
                <Route path="/doctor/wallet" element={<WalletPage audience="professional" />} />
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
                <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
                <Route path="/admin/specialties" element={<AdminSpecialties />} />
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
