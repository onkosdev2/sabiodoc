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
import SupportLayout from './components/SupportLayout'
import RouteFallback from './components/RouteFallback'
import AuthenticatedRoute from './components/guards/AuthenticatedRoute'
import DoctorRoute from './components/guards/DoctorRoute'
import PatientRoute from './components/guards/PatientRoute'
import AdminRoute from './components/guards/AdminRoute'
import ReviewerRoute from './components/guards/ReviewerRoute'
import SupportRoute from './components/guards/SupportRoute'
import NotFound from './pages/NotFound'

// Páginas con carga diferida (code-splitting por ruta).
const Home = lazyWithRetry(() => import('./pages/Home'))
const ComoFunciona = lazyWithRetry(() => import('./pages/ComoFunciona'))
const Specialties = lazyWithRetry(() => import('./pages/Specialties'))
const SpecialtyDetail = lazyWithRetry(() => import('./pages/SpecialtyDetail'))
const DoctorDetailPage = lazyWithRetry(() => import('./pages/DoctorDetail'))
const Triage = lazyWithRetry(() => import('./pages/Triage'))
const Guide = lazyWithRetry(() => import('./pages/Guide'))
const MyConsultations = lazyWithRetry(() => import('./pages/MyConsultations'))
const MyFavorites = lazyWithRetry(() => import('./pages/MyFavorites'))
const Emergency = lazyWithRetry(() => import('./pages/Emergency'))
const Privacy = lazyWithRetry(() => import('./pages/Privacy'))
const Terms = lazyWithRetry(() => import('./pages/Terms'))
const Telemedicine = lazyWithRetry(() => import('./pages/Telemedicine'))
const Login = lazyWithRetry(() => import('./pages/Login'))
const Register = lazyWithRetry(() => import('./pages/Register'))
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'))
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'))
const VerifyEmail = lazyWithRetry(() => import('./pages/VerifyEmail'))
const DoctorOnboarding = lazyWithRetry(() => import('./pages/DoctorOnboarding'))
const AdminDoctorApplications = lazyWithRetry(() => import('./pages/AdminDoctorApplications'))
const AdminOverview = lazyWithRetry(() => import('./pages/AdminOverview'))
const AdminAppointments = lazyWithRetry(() => import('./pages/AdminAppointments'))
const AdminUsers = lazyWithRetry(() => import('./pages/AdminUsers'))
const AdminUserSupport = lazyWithRetry(() => import('./pages/AdminUserSupport'))
const SupportUsers = lazyWithRetry(() => import('./pages/SupportUsers'))
const SupportInbox = lazyWithRetry(() => import('./pages/SupportInbox'))
const HelpSupport = lazyWithRetry(() => import('./pages/HelpSupport'))
const AdminSystemHealth = lazyWithRetry(() => import('./pages/AdminSystemHealth'))
const AdminErrors = lazyWithRetry(() => import('./pages/AdminErrors'))
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
const SecuritySettings = lazyWithRetry(() => import('./pages/SecuritySettings'))
const WalletPage = lazyWithRetry(() => import('./pages/Wallet'))
const AdminSpecialties = lazyWithRetry(() => import('./pages/AdminSpecialties'))
const AdminReviews = lazyWithRetry(() => import('./pages/AdminReviews'))
const AdminFinance = lazyWithRetry(() => import('./pages/AdminFinance'))

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
              <Route path="/como-funciona" element={<ComoFunciona />} />
              <Route path="/specialties" element={<Specialties />} />
              <Route path="/specialties/:slug" element={<SpecialtyDetail />} />
              <Route path="/doctors/:doctorId" element={<DoctorDetailPage />} />
              <Route path="/triage" element={<Triage />} />
              <Route path="/guide" element={<Guide />} />
              <Route path="/emergency" element={<Emergency />} />
              <Route path="/privacidad" element={<Privacy />} />
              <Route path="/terminos" element={<Terms />} />
              <Route path="/telemedicina" element={<Telemedicine />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
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
                <Route path="/me/security" element={<SecuritySettings />} />
                <Route path="/help" element={<HelpSupport />} />
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
                <Route path="/doctor/security" element={<SecuritySettings />} />
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
                <Route path="/admin/users/:userId/support" element={<AdminUserSupport />} />
                <Route path="/admin/withdrawals" element={<Navigate to="/admin/finance" replace />} />
                <Route path="/admin/specialties" element={<AdminSpecialties />} />
                <Route path="/admin/reviews" element={<AdminReviews />} />
                <Route path="/admin/finance" element={<AdminFinance />} />
                <Route path="/admin/system" element={<AdminSystemHealth />} />
                <Route path="/admin/errors" element={<AdminErrors />} />
                <Route path="/admin/security" element={<SecuritySettings />} />
                <Route path="/admin/notifications" element={<NotificationsPage />} />
              </Route>
            </Route>

            {/* Panel de revisión */}
            <Route element={<ReviewerRoute />}>
              <Route element={<ReviewerLayout />}>
                <Route path="/reviewer" element={<Navigate to="/reviewer/doctor-applications" replace />} />
                <Route path="/reviewer/doctor-applications" element={<ReviewerDoctorApplications />} />
                <Route path="/reviewer/security" element={<SecuritySettings />} />
              </Route>
            </Route>

            {/* Panel de soporte */}
            <Route element={<SupportRoute />}>
              <Route element={<SupportLayout />}>
                <Route path="/support" element={<Navigate to="/support/tickets" replace />} />
                <Route path="/support/users" element={<SupportUsers />} />
                <Route path="/support/tickets" element={<SupportInbox />} />
                <Route
                  path="/support/users/:userId"
                  element={<AdminUserSupport basePath="/support/users" />}
                />
                <Route path="/support/security" element={<SecuritySettings />} />
                <Route path="/support/notifications" element={<NotificationsPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </NotificationsProvider>
    </AuthProvider>
  )
}

export default App
