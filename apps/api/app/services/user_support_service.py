"""Vista de soporte 360° de un usuario para el panel de administración.

Reúne en una sola respuesta todo lo necesario para diagnosticar un problema de
un usuario: roles, citas (con el médico/paciente de cada una), videoconsultas,
consultas de IA, monedero, retiros, errores recientes y notificaciones.
"""

from datetime import UTC, datetime

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.appointment import Appointment, AppointmentStatus
from app.models.consultation import Consultation
from app.models.doctor_profile import DoctorProfile
from app.models.error_log import ErrorLog
from app.models.notification import Notification, NotificationStatus
from app.models.user import User, sorted_roles
from app.models.video_session import VideoSession, VideoSessionStatus
from app.models.wallet import WalletTransaction, Withdrawal
from app.schemas.support import (
    SupportAppointmentItem,
    SupportConsultationItem,
    SupportCounterpart,
    SupportDoctorProfile,
    SupportErrorItem,
    SupportNotificationItem,
    SupportStats,
    SupportUserDetailResponse,
    SupportUserSummary,
    SupportVideoSessionItem,
    SupportWalletTransaction,
    SupportWithdrawal,
)
from app.services.patient_profile_service import get_patient_display_name
from app.services.wallet_service import wallet_service

LIST_LIMIT = 20


class UserSupportService:
    def build(self, db: Session, user: User) -> SupportUserDetailResponse:
        profile = (
            db.query(DoctorProfile)
            .options(joinedload(DoctorProfile.user), joinedload(DoctorProfile.doctor_specialties))
            .filter(DoctorProfile.user_id == user.id)
            .first()
        )
        profile_id = profile.id if profile else None

        appointments = self._appointments(db, user, profile_id)
        video_sessions = self._video_sessions(db, user, profile_id)
        video_by_appointment = {
            session.appointment_id: session.id
            for session in video_sessions
            if session.appointment_id is not None
        }

        appointments_items = [
            self._appointment_item(appointment, profile_id, video_by_appointment)
            for appointment in appointments
        ]

        active_session = self._active_session(db, user, profile_id)
        next_appointment = self._next_appointment(db, user, profile_id)

        transactions, _ = wallet_service.list_transactions(db, user.id, limit=10, offset=0)

        return SupportUserDetailResponse(
            user=self._user_summary(user, profile),
            doctor_profile=self._doctor_profile(profile),
            active_session=active_session,
            next_appointment=self._appointment_item(next_appointment, profile_id, video_by_appointment)
            if next_appointment
            else None,
            stats=self._stats(db, user, profile_id),
            appointments=appointments_items,
            video_sessions=[self._video_item(s, profile_id) for s in video_sessions],
            consultations=self._consultations(db, user),
            wallet_balance_cents=wallet_service.get_balance_cents(db, user.id),
            transactions=[self._transaction(t) for t in transactions],
            withdrawals=self._withdrawals(db, user),
            errors=self._errors(db, user),
            notifications=self._notifications(db, user),
        )

    # ------------------------------------------------------------------
    # Serializadores
    # ------------------------------------------------------------------
    def _user_summary(self, user: User, profile: DoctorProfile | None) -> SupportUserSummary:
        return SupportUserSummary(
            id=user.id,
            email=user.email,
            roles=sorted_roles(user.roles),
            primary_role=user.primary_role,
            doctor_status=profile.status if profile else None,
            is_email_verified=bool(user.is_email_verified),
            created_at=user.created_at,
            session_version=user.session_version or 1,
        )

    def _doctor_profile(self, profile: DoctorProfile | None) -> SupportDoctorProfile | None:
        if not profile:
            return None
        specialties = sorted(
            (
                link.specialty.name
                for link in profile.doctor_specialties
                if link.specialty is not None
            ),
        )
        return SupportDoctorProfile(
            doctor_id=profile.id,
            display_name=profile.display_name,
            professional_title=profile.professional_title,
            price_per_min_cents=profile.price_per_min_cents,
            status=profile.status,
            rating_avg=float(profile.rating_avg or 0),
            rating_count=profile.rating_count or 0,
            is_accepting_consultations=bool(profile.is_accepting_consultations),
            specialties=specialties,
        )

    @staticmethod
    def _patient_counterpart(patient: User | None) -> SupportCounterpart:
        if not patient:
            return SupportCounterpart(role="patient")
        return SupportCounterpart(
            user_id=patient.id,
            name=get_patient_display_name(patient),
            email=patient.email,
            role="patient",
        )

    @staticmethod
    def _doctor_counterpart(doctor: DoctorProfile | None) -> SupportCounterpart:
        if not doctor:
            return SupportCounterpart(role="doctor")
        return SupportCounterpart(
            user_id=doctor.user_id,
            name=doctor.display_name,
            email=doctor.user.email if doctor.user else None,
            role="doctor",
        )

    def _appointment_item(
        self,
        appointment: Appointment,
        viewer_profile_id: int | None,
        video_by_appointment: dict[int, int] | None = None,
    ) -> SupportAppointmentItem:
        # El "otro" participante depende de quién es el usuario consultado.
        if viewer_profile_id is not None and appointment.doctor_id == viewer_profile_id:
            counterpart = self._patient_counterpart(appointment.patient)
        else:
            counterpart = self._doctor_counterpart(appointment.doctor)

        payment = getattr(appointment, "payment", None)
        return SupportAppointmentItem(
            id=appointment.id,
            specialty_name=appointment.specialty.name if appointment.specialty else "Especialidad",
            status=appointment.status.value,
            scheduled_at=appointment.scheduled_at,
            duration_minutes=appointment.duration_minutes,
            counterpart=counterpart,
            payment_amount_cents=payment.amount_cents if payment else None,
            payment_status=payment.status.value if payment else None,
            payment_doctor_amount_cents=payment.doctor_amount_cents if payment else None,
            video_session_id=(
                video_by_appointment.get(appointment.id) if video_by_appointment else None
            ),
            created_at=appointment.created_at,
        )

    def _video_item(
        self, session: VideoSession, viewer_profile_id: int | None
    ) -> SupportVideoSessionItem:
        if viewer_profile_id is not None and session.doctor_id == viewer_profile_id:
            counterpart = self._patient_counterpart(session.patient)
        else:
            counterpart = self._doctor_counterpart(session.doctor)
        return SupportVideoSessionItem(
            id=session.id,
            status=session.status.value,
            provider=session.provider.value,
            room_name=session.provider_room_name,
            counterpart=counterpart,
            appointment_id=session.appointment_id,
            consultation_id=session.consultation_id,
            created_at=session.created_at,
            started_at=session.started_at,
            ended_at=session.ended_at,
            billable_seconds=session.billable_seconds or 0,
            price_per_min_cents=session.doctor_price_per_min_cents or 0,
            prepaid_amount_cents=session.prepaid_amount_cents or 0,
            closed_reason=session.closed_reason,
        )

    @staticmethod
    def _transaction(transaction: WalletTransaction) -> SupportWalletTransaction:
        return SupportWalletTransaction(
            id=transaction.id,
            type=transaction.type.value,
            status=transaction.status.value,
            amount_cents=transaction.amount_cents,
            balance_after_cents=transaction.balance_after_cents,
            description=transaction.description,
            reference_type=transaction.reference_type,
            reference_id=transaction.reference_id,
            created_at=transaction.created_at,
        )

    # ------------------------------------------------------------------
    # Consultas
    # ------------------------------------------------------------------
    def _appointments(
        self, db: Session, user: User, profile_id: int | None
    ) -> list[Appointment]:
        query = (
            db.query(Appointment)
            .options(
                joinedload(Appointment.specialty),
                joinedload(Appointment.patient),
                joinedload(Appointment.doctor).joinedload(DoctorProfile.user),
                joinedload(Appointment.payment),
            )
            .filter(self._appointment_scope(user, profile_id))
            .order_by(Appointment.scheduled_at.desc())
            .limit(LIST_LIMIT)
        )
        return query.all()

    def _video_sessions(
        self, db: Session, user: User, profile_id: int | None
    ) -> list[VideoSession]:
        query = (
            db.query(VideoSession)
            .options(
                joinedload(VideoSession.patient),
                joinedload(VideoSession.doctor).joinedload(DoctorProfile.user),
            )
            .filter(self._video_scope(user, profile_id))
            .order_by(VideoSession.created_at.desc())
            .limit(LIST_LIMIT)
        )
        return query.all()

    def _active_session(
        self, db: Session, user: User, profile_id: int | None
    ) -> SupportVideoSessionItem | None:
        now = datetime.now(UTC)
        session = (
            db.query(VideoSession)
            .options(
                joinedload(VideoSession.patient),
                joinedload(VideoSession.doctor).joinedload(DoctorProfile.user),
            )
            .filter(
                self._video_scope(user, profile_id),
                VideoSession.status.in_(
                    [VideoSessionStatus.prepared, VideoSessionStatus.active]
                ),
                VideoSession.expires_at > now,
            )
            .order_by(VideoSession.created_at.desc())
            .first()
        )
        return self._video_item(session, profile_id) if session else None

    def _next_appointment(
        self, db: Session, user: User, profile_id: int | None
    ) -> Appointment | None:
        now = datetime.now(UTC)
        return (
            db.query(Appointment)
            .options(
                joinedload(Appointment.specialty),
                joinedload(Appointment.patient),
                joinedload(Appointment.doctor).joinedload(DoctorProfile.user),
                joinedload(Appointment.payment),
            )
            .filter(
                self._appointment_scope(user, profile_id),
                Appointment.status == AppointmentStatus.scheduled,
                Appointment.scheduled_at >= now,
            )
            .order_by(Appointment.scheduled_at.asc())
            .first()
        )

    def _consultations(self, db: Session, user: User) -> list[SupportConsultationItem]:
        rows = (
            db.query(Consultation)
            .options(joinedload(Consultation.specialty))
            .filter(Consultation.user_id == user.id)
            .order_by(Consultation.created_at.desc())
            .limit(10)
            .all()
        )
        return [
            SupportConsultationItem(
                id=row.id,
                status=row.status.value,
                specialty_name=row.specialty.name if row.specialty else "Especialidad",
                created_at=row.created_at,
                closed_at=row.closed_at,
                auto_closed=bool(row.auto_closed),
                has_summary=bool(row.summary),
            )
            for row in rows
        ]

    def _withdrawals(self, db: Session, user: User) -> list[SupportWithdrawal]:
        rows = (
            db.query(Withdrawal)
            .filter(Withdrawal.user_id == user.id)
            .order_by(Withdrawal.created_at.desc())
            .limit(10)
            .all()
        )
        return [
            SupportWithdrawal(
                id=row.id,
                amount_cents=row.amount_cents,
                status=row.status.value,
                destination=row.destination,
                provider=row.provider,
                provider_reference=row.provider_reference,
                failure_reason=row.failure_reason,
                created_at=row.created_at,
            )
            for row in rows
        ]

    def _errors(self, db: Session, user: User) -> list[SupportErrorItem]:
        rows = (
            db.query(ErrorLog)
            .filter(ErrorLog.user_id == user.id)
            .order_by(ErrorLog.created_at.desc(), ErrorLog.id.desc())
            .limit(10)
            .all()
        )
        return [
            SupportErrorItem(
                id=row.id,
                created_at=row.created_at,
                level=row.level,
                source=row.source,
                status_code=row.status_code,
                method=row.method,
                path=row.path,
                error_type=row.error_type,
                message=row.message,
                request_id=row.request_id,
                video_session_id=row.video_session_id,
            )
            for row in rows
        ]

    def _notifications(self, db: Session, user: User) -> list[SupportNotificationItem]:
        rows = (
            db.query(Notification)
            .filter(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(10)
            .all()
        )
        return [
            SupportNotificationItem(
                id=row.id,
                type=row.type,
                title=row.title,
                body=row.body,
                action_url=row.action_url,
                created_at=row.created_at,
            )
            for row in rows
        ]

    # ------------------------------------------------------------------
    # Filtros y totales
    # ------------------------------------------------------------------
    @staticmethod
    def _appointment_scope(user: User, profile_id: int | None):
        if profile_id is not None:
            return or_(
                Appointment.patient_id == user.id,
                Appointment.doctor_id == profile_id,
            )
        return Appointment.patient_id == user.id

    @staticmethod
    def _video_scope(user: User, profile_id: int | None):
        if profile_id is not None:
            return or_(
                VideoSession.patient_id == user.id,
                VideoSession.doctor_id == profile_id,
            )
        return VideoSession.patient_id == user.id

    def _stats(self, db: Session, user: User, profile_id: int | None) -> SupportStats:
        appointment_scope = self._appointment_scope(user, profile_id)
        video_scope = self._video_scope(user, profile_id)

        appointments_total = db.query(func.count(Appointment.id)).filter(appointment_scope).scalar() or 0
        appointments_completed = (
            db.query(func.count(Appointment.id))
            .filter(appointment_scope, Appointment.status == AppointmentStatus.completed)
            .scalar()
            or 0
        )
        appointments_no_show = (
            db.query(func.count(Appointment.id))
            .filter(appointment_scope, Appointment.status == AppointmentStatus.no_show)
            .scalar()
            or 0
        )
        video_sessions_total = (
            db.query(func.count(VideoSession.id)).filter(video_scope).scalar() or 0
        )
        consultations_total = (
            db.query(func.count(Consultation.id))
            .filter(Consultation.user_id == user.id)
            .scalar()
            or 0
        )
        unread_notifications = (
            db.query(func.count(Notification.id))
            .filter(
                Notification.user_id == user.id,
                Notification.status == NotificationStatus.unread,
            )
            .scalar()
            or 0
        )
        errors_total = (
            db.query(func.count(ErrorLog.id)).filter(ErrorLog.user_id == user.id).scalar() or 0
        )

        return SupportStats(
            appointments_total=int(appointments_total),
            appointments_completed=int(appointments_completed),
            appointments_no_show=int(appointments_no_show),
            video_sessions_total=int(video_sessions_total),
            consultations_total=int(consultations_total),
            unread_notifications=int(unread_notifications),
            errors_total=int(errors_total),
        )


user_support_service = UserSupportService()
