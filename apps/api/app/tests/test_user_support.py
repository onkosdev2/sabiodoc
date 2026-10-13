"""Vista de soporte 360° de un usuario para el panel de admin."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.appointment import Appointment
from app.models.doctor_profile import DoctorProfile
from app.models.error_log import ErrorLog
from app.models.specialty import Specialty
from app.models.user import User, UserRole
from app.models.wallet import Wallet, WalletTransaction
from app.services.wallet_service import wallet_service

client = TestClient(app)


def _make_user(db, roles: set[UserRole]) -> User:
    user = User(
        email=f"support_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="x",
    )
    user.set_roles(roles)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_doctor_profile(db, doctor_user: User) -> DoctorProfile:
    profile = DoctorProfile(
        user_id=doctor_user.id,
        display_name="Dr. Soporte Test",
        price_per_min_cents=500,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def _make_appointment(db, patient: User, profile: DoctorProfile) -> Appointment:
    specialty = db.query(Specialty).first()
    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=profile.id,
        specialty_id=specialty.id,
        scheduled_at=datetime.now(UTC) + timedelta(days=2),
        duration_minutes=30,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def _cleanup(db, user_ids: list[int], appointment_ids: list[int]) -> None:
    if appointment_ids:
        db.query(Appointment).filter(Appointment.id.in_(appointment_ids)).delete(
            synchronize_session=False
        )
    if user_ids:
        db.query(ErrorLog).filter(ErrorLog.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(WalletTransaction).filter(WalletTransaction.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(Wallet).filter(Wallet.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(DoctorProfile).filter(DoctorProfile.user_id.in_(user_ids)).delete(
            synchronize_session=False
        )
        db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
    db.commit()


def _admin_headers() -> dict:
    login = client.post(
        "/auth/login",
        json={"email": "admin.demo@sabiodoc.app", "password": "AdminDemo123!"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _support_headers() -> dict:
    login = client.post(
        "/auth/login",
        json={"email": "soporte.demo@sabiodoc.app", "password": "SupportDemo123!"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_rol_soporte_ve_usuarios_pero_no_edita():
    db = SessionLocal()
    user_ids: list[int] = []
    try:
        target = _make_user(db, {UserRole.patient})
        user_ids = [target.id]
        headers = _support_headers()

        # Puede listar usuarios y ver la vista de soporte.
        assert client.get("/admin/users", headers=headers).status_code == 200
        support = client.get(f"/admin/users/{target.id}/support", headers=headers)
        assert support.status_code == 200, support.text
        assert support.json()["user"]["id"] == target.id

        # No puede crear, editar ni eliminar usuarios.
        assert client.post(
            "/admin/users",
            json={
                "email": f"nope_{uuid.uuid4().hex[:8]}@example.com",
                "password": "NoPass123!",
                "roles": ["patient"],
            },
            headers=headers,
        ).status_code == 403
        assert client.patch(
            f"/admin/users/{target.id}", json={"roles": ["support"]}, headers=headers
        ).status_code == 403
        assert client.delete(f"/admin/users/{target.id}", headers=headers).status_code == 403

        # Tampoco accede a otras áreas de administración.
        assert client.get("/admin/finance/overview", headers=headers).status_code == 403
        assert client.get("/admin/reviewers", headers=headers).status_code == 403
    finally:
        _cleanup(db, user_ids=user_ids, appointment_ids=[])
        db.close()


def test_support_requiere_admin():
    assert client.get("/admin/users/1/support").status_code in (401, 403)


def test_support_usuario_inexistente():
    headers = _admin_headers()
    assert client.get("/admin/users/99999999/support", headers=headers).status_code == 404


def test_support_muestra_cita_y_contraparte():
    db = SessionLocal()
    user_ids: list[int] = []
    appointment_ids: list[int] = []
    try:
        patient = _make_user(db, {UserRole.patient})
        doctor_user = _make_user(db, {UserRole.doctor})
        profile = _make_doctor_profile(db, doctor_user)
        appointment = _make_appointment(db, patient, profile)
        user_ids = [patient.id, doctor_user.id]
        appointment_ids = [appointment.id]

        # Un error reciente del usuario para el soporte.
        db.add(
            ErrorLog(
                level="error",
                source="client",
                message="No se pudo entrar a la sala",
                user_id=patient.id,
                user_email=patient.email,
                video_session_id=123,
            )
        )
        wallet_service.topup(db, patient.id, 5000)
        db.commit()

        headers = _admin_headers()

        # Vista del paciente: la contraparte es el médico.
        response = client.get(f"/admin/users/{patient.id}/support", headers=headers)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["user"]["id"] == patient.id
        assert set(body["user"]["roles"]) == {"patient"}
        assert body["stats"]["appointments_total"] == 1
        assert body["stats"]["errors_total"] == 1
        assert body["wallet_balance_cents"] == 5000
        assert len(body["appointments"]) == 1
        assert body["appointments"][0]["counterpart"]["role"] == "doctor"
        assert body["appointments"][0]["counterpart"]["name"] == "Dr. Soporte Test"
        assert body["next_appointment"]["id"] == appointment.id
        assert body["errors"][0]["message"] == "No se pudo entrar a la sala"

        # Vista del médico: la contraparte es el paciente.
        doctor_response = client.get(
            f"/admin/users/{doctor_user.id}/support", headers=headers
        )
        assert doctor_response.status_code == 200, doctor_response.text
        doctor_body = doctor_response.json()
        assert doctor_body["doctor_profile"]["doctor_id"] == profile.id
        assert doctor_body["appointments"][0]["counterpart"]["role"] == "patient"
        assert doctor_body["appointments"][0]["counterpart"]["user_id"] == patient.id
    finally:
        _cleanup(db, user_ids=user_ids, appointment_ids=appointment_ids)
        db.close()
