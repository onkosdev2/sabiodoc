"""Finanzas de la plataforma: comisión, cobros, transacciones y payouts."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.session import SessionLocal
from app.main import app
from app.models.appointment import Appointment
from app.models.doctor_profile import DoctorProfile
from app.models.notification import Notification
from app.models.payment import (
    ConsultationCharge,
    ConsultationChargeStatus,
    DoctorEarning,
    DoctorEarningStatus,
    PaymentTransaction,
    PaymentTransactionStatus,
    PaymentTransactionType,
    Payout,
    PayoutStatus,
)
from app.models.specialty import Specialty
from app.models.user import User, UserRole
from app.services.finance_service import finance_service

client = TestClient(app)


def _make_user(db, role: UserRole = UserRole.patient) -> User:
    user = User(email=f"finance_{uuid.uuid4().hex[:8]}@example.com", password_hash="x")
    user.set_roles({role})
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_appointment(db, patient: User, doctor_user: User) -> Appointment:
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
        duration_minutes=30,
        confirmation_status="confirmed",
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def _settle_payment(db) -> tuple[User, User, Appointment, ConsultationCharge]:
    patient = _make_user(db)
    doctor_user = _make_user(db, UserRole.doctor)
    appointment = _make_appointment(db, patient, doctor_user)
    charge = ConsultationCharge(
        appointment_id=appointment.id,
        patient_id=patient.id,
        doctor_id=appointment.doctor_id,
        quoted_minutes=30,
        quoted_amount_cents=15000,
        paid_minutes=30,
        paid_amount_cents=15000,
        platform_fee_cents=3000,
        doctor_net_cents=12000,
        status=ConsultationChargeStatus.paid,
    )
    db.add(charge)
    db.flush()
    transaction = PaymentTransaction(
        user_id=patient.id,
        appointment_id=appointment.id,
        type=PaymentTransactionType.initial,
        status=PaymentTransactionStatus.succeeded,
        amount_cents=15000,
        currency="USD",
        provider="mock",
        idempotency_key=f"test-{uuid.uuid4().hex}",
    )
    db.add(transaction)
    db.add(
        DoctorEarning(
            doctor_id=appointment.doctor_id,
            appointment_id=appointment.id,
            gross_cents=15000,
            platform_fee_cents=3000,
            net_cents=12000,
            status=DoctorEarningStatus.available,
            available_at=datetime.now(UTC),
        )
    )
    db.commit()
    db.refresh(charge)
    return patient, doctor_user, appointment, charge


def _cleanup(db, *, users: list[User], appointment: Appointment | None) -> None:
    if appointment is not None:
        db.query(DoctorEarning).filter(
            DoctorEarning.appointment_id == appointment.id
        ).delete(synchronize_session=False)
        db.query(PaymentTransaction).filter(
            PaymentTransaction.appointment_id == appointment.id
        ).delete(synchronize_session=False)
        db.query(ConsultationCharge).filter(
            ConsultationCharge.appointment_id == appointment.id
        ).delete(synchronize_session=False)
        db.query(Appointment).filter(Appointment.id == appointment.id).delete(
            synchronize_session=False
        )
    user_ids = [user.id for user in users]
    if user_ids:
        db.query(Payout).filter(Payout.doctor_id.in_(
            db.query(DoctorProfile.id).filter(DoctorProfile.user_id.in_(user_ids))
        )).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(DoctorProfile).filter(DoctorProfile.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
    db.commit()


def test_comision_del_20_por_ciento():
    assert settings.PLATFORM_FEE_BPS == 2000
    policy = finance_service.policy()
    assert policy["platform_fee_percent"] == 20.0


def test_resumen_y_comisiones_con_cobros_confirmados():
    db = SessionLocal()
    patients: list[User] = []
    appointment = None
    try:
        patient, doctor_user, appointment, charge = _settle_payment(db)
        patients = [patient, doctor_user]
        start = datetime.now(UTC) - timedelta(minutes=5)

        overview = finance_service.overview(db, start=start)
        assert overview["platform_revenue_cents"] >= 3000
        assert overview["gmv_cents"] >= 15000
        assert overview["doctor_net_cents"] >= 12000
        assert overview["paid_consultations"] >= 1

        commissions = finance_service.commissions(db, start=start)
        assert commissions["fee_cents"] >= 3000
        assert any(item["charge_id"] == charge.id for item in commissions["items"])

        movements = finance_service.movements(db, start=start)
        assert any(item["type"] == "initial" for item in movements["items"])
    finally:
        _cleanup(db, users=patients, appointment=appointment)
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
    email = f"policy_{uuid.uuid4().hex[:8]}@example.com"
    register = client.post("/auth/register", json={"email": email, "password": "testpassword123"})
    assert register.status_code == 201, register.text
    headers = {"Authorization": f"Bearer {register.json()['access_token']}"}
    response = client.get("/finance/policy", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["platform_fee_bps"] == 2000
    assert body["platform_fee_percent"] == 20.0
