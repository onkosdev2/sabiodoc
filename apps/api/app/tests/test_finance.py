"""Finanzas de la plataforma: comisión del 20%, resumen y endpoints de admin."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.session import SessionLocal
from app.main import app
from app.models.appointment import Appointment
from app.models.doctor_profile import DoctorProfile
from app.models.notification import Notification
from app.models.specialty import Specialty
from app.models.user import User, UserRole
from app.models.video_session import VideoSession
from app.models.video_session_event import VideoSessionEvent
from app.models.wallet import AppointmentPayment, Wallet, WalletTransaction, Withdrawal
from app.services.finance_service import finance_service
from app.services.wallet_service import wallet_service

client = TestClient(app)


def _make_user(db, role: UserRole = UserRole.patient) -> User:
    user = User(
        email=f"finance_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="x",
    )
    user.set_roles({role})
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _cleanup(db, *, user_ids: list[int], appointment_ids: list[int]) -> None:
    if appointment_ids:
        session_ids = [
            row[0]
            for row in db.query(VideoSession.id).filter(
                VideoSession.appointment_id.in_(appointment_ids)
            )
        ]
        if session_ids:
            db.query(VideoSessionEvent).filter(
                VideoSessionEvent.video_session_id.in_(session_ids)
            ).delete(synchronize_session=False)
            db.query(VideoSession).filter(VideoSession.id.in_(session_ids)).delete(
                synchronize_session=False
            )
        db.query(AppointmentPayment).filter(
            AppointmentPayment.appointment_id.in_(appointment_ids)
        ).delete(synchronize_session=False)
        db.query(Appointment).filter(Appointment.id.in_(appointment_ids)).delete(
            synchronize_session=False
        )
    if user_ids:
        db.query(Notification).filter(Notification.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(WalletTransaction).filter(WalletTransaction.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(Withdrawal).filter(Withdrawal.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(Wallet).filter(Wallet.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(DoctorProfile).filter(DoctorProfile.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
    db.commit()


def _make_appointment(db, patient: User, doctor_user: User, duration: int = 30) -> Appointment:
    profile = DoctorProfile(
        user_id=doctor_user.id,
        display_name="Dr. Finanzas Test",
        price_per_min_cents=500,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    specialty = db.query(Specialty).first()
    assert specialty is not None
    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=profile.id,
        specialty_id=specialty.id,
        scheduled_at=datetime.now(UTC) + timedelta(days=1),
        duration_minutes=duration,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def _settle_appointment(db) -> tuple[int, int, int, list[int], list[int]]:
    """Crea una cita de 30 min, cobra 15000 y liquida 2500 (5 min). Devuelve ids."""
    patient = _make_user(db)
    doctor_user = _make_user(db, UserRole.doctor)
    appointment = _make_appointment(db, patient, doctor_user)
    wallet_service.topup(db, patient.id, 20000)
    held = wallet_service.appointment_amount_cents(appointment)
    wallet_service.charge_appointment(db, appointment, held)
    db.commit()
    payment = wallet_service.release_appointment(db, appointment, billable_seconds=300)
    db.commit()
    return appointment.id, payment.id, doctor_user.id, [patient.id, doctor_user.id], [appointment.id]


def test_comision_del_20_por_ciento():
    assert settings.PLATFORM_FEE_BPS == 2000
    assert wallet_service.platform_fee_cents(10000) == 2000
    assert wallet_service.doctor_net_cents(10000) == 8000


def test_liquidacion_aplica_comision():
    db = SessionLocal()
    user_ids: list[int] = []
    appointment_ids: list[int] = []
    try:
        _appt_id, payment_id, doctor_user_id, user_ids, appointment_ids = _settle_appointment(db)
        payment = db.query(AppointmentPayment).filter(AppointmentPayment.id == payment_id).first()
        assert payment.billable_amount_cents == 2500
        assert payment.platform_fee_cents == 500  # 20% de 2500
        assert payment.doctor_amount_cents == 2000
        assert wallet_service.get_balance_cents(db, doctor_user_id) == 2000
    finally:
        _cleanup(db, user_ids=user_ids, appointment_ids=appointment_ids)
        db.close()


def test_resumen_y_comisiones_de_finanzas():
    db = SessionLocal()
    user_ids: list[int] = []
    appointment_ids: list[int] = []
    try:
        _appt_id, payment_id, _doctor_id, user_ids, appointment_ids = _settle_appointment(db)
        start = datetime.now(UTC) - timedelta(minutes=5)

        overview = finance_service.overview(db, start=start)
        assert overview["platform_fee_bps"] == 2000
        assert overview["platform_revenue_cents"] >= 500
        assert overview["gmv_cents"] >= 2500
        assert overview["doctor_payouts_cents"] >= 2000

        commissions = finance_service.commissions(db, start=start)
        assert commissions["fee_cents"] >= 500
        assert any(item["appointment_payment_id"] == payment_id for item in commissions["items"])

        movements = finance_service.movements(db, start=start)
        types = {item["type"] for item in movements["items"]}
        assert "topup" in types or "consultation_income" in types
    finally:
        _cleanup(db, user_ids=user_ids, appointment_ids=appointment_ids)
        db.close()


def test_income_summary_del_medico():
    db = SessionLocal()
    user_ids: list[int] = []
    appointment_ids: list[int] = []
    try:
        _appt_id, _payment_id, doctor_user_id, user_ids, appointment_ids = _settle_appointment(db)
        profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor_user_id).first()
        summary = wallet_service.doctor_income_summary(db, profile.id)
        assert summary["gross_income_cents"] == 2500
        assert summary["platform_fee_cents"] == 500
        assert summary["net_income_cents"] == 2000
        assert summary["completed_count"] == 1

        payload = wallet_service.build_wallet_response(
            db, doctor_user_id, doctor_profile_id=profile.id
        )
        assert payload["platform_fee_percent"] == 20.0
        assert payload["income_summary"]["net_income_cents"] == 2000
    finally:
        _cleanup(db, user_ids=user_ids, appointment_ids=appointment_ids)
        db.close()


def _admin_headers() -> dict:
    login = client.post(
        "/auth/login",
        json={"email": "admin.demo@sabiodoc.app", "password": "AdminDemo123!"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_endpoints_de_finanzas_solo_admin():
    assert client.get("/admin/finance/overview").status_code in (401, 403)

    headers = _admin_headers()
    overview = client.get("/admin/finance/overview", headers=headers)
    assert overview.status_code == 200, overview.text
    assert overview.json()["platform_fee_percent"] == 20.0

    transactions = client.get("/admin/finance/transactions", headers=headers)
    assert transactions.status_code == 200
    assert "items" in transactions.json()

    commissions = client.get("/admin/finance/commissions", headers=headers)
    assert commissions.status_code == 200
    assert "items" in commissions.json()


def test_politica_de_finanzas_autenticada():
    import uuid as _uuid

    email = f"policy_{_uuid.uuid4().hex[:8]}@example.com"
    register = client.post("/auth/register", json={"email": email, "password": "testpassword123"})
    assert register.status_code == 201, register.text
    headers = {"Authorization": f"Bearer {register.json()['access_token']}"}
    response = client.get("/finance/policy", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["platform_fee_bps"] == 2000
    assert body["platform_fee_percent"] == 20.0
