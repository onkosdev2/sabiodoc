"""Tests de control de usuarios y combinaciones de roles.

Cubren el modelo de capacidades aditivas:
- Un revisor puede revisar postulaciones y ademas ser paciente.
- Un revisor puede ser tambien medico (rol reviewer + DoctorProfile).
- Un medico puede actuar como paciente.
- CRUD de usuarios del panel admin y sus protecciones.

Requieren la base de datos de desarrollo con el admin demo sembrado
(admin.demo@sabiodoc.app / AdminDemo123!).
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ADMIN_EMAIL = "admin.demo@sabiodoc.app"
ADMIN_PASSWORD = "AdminDemo123!"


def _unique(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def _admin_headers() -> dict:
    response = client.post(
        "/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if response.status_code != 200:
        pytest.skip("El admin demo no esta disponible en la base de datos")
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _login(email: str, password: str) -> str:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _first_specialty_id() -> int:
    response = client.get("/specialties")
    assert response.status_code == 200
    specialties = response.json()["specialties"]
    assert specialties
    return specialties[0]["id"]


def _doctor_payload(email: str, password: str, specialty_id: int) -> dict:
    return {
        "email": email,
        "password": password,
        "display_name": "Dr. Test Combinaciones",
        "professional_title": "Medico general",
        "bio_short": "Perfil de prueba para combinaciones de roles.",
        "price_per_min_cents": 2500,
        "license_number": "LIC-TEST-ROLES",
        "license_country": "Peru",
        "country": "Peru",
        "city": "Lima",
        "timezone": "America/Lima",
        "government_id": "DNI 87654321",
        "years_experience": 4,
        "specialty_ids": [specialty_id],
    }


def _create_user(admin: dict, email: str, password: str, role: str, is_reviewer: bool = False) -> int:
    response = client.post(
        "/admin/users",
        json={"email": email, "password": password, "role": role, "is_reviewer": is_reviewer},
        headers=admin,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _delete_user(admin: dict, user_id: int | None) -> None:
    if user_id is None:
        return
    client.delete(f"/admin/users/{user_id}", headers=admin)


def _approve_doctor(admin: dict, doctor_token: str) -> int:
    response = client.get("/doctors/me/application", headers=_auth(doctor_token))
    assert response.status_code == 200, response.text
    doctor_id = response.json()["doctor_id"]
    response = client.post(
        f"/doctors/applications/{doctor_id}/status",
        json={"status": "approved"},
        headers=admin,
    )
    assert response.status_code == 200, response.text
    return doctor_id


def test_admin_user_crud():
    admin = _admin_headers()
    email = _unique("crud")
    user_id = None
    try:
        user_id = _create_user(admin, email, "CrudPass123!", "patient", is_reviewer=True)

        # Read
        response = client.get(f"/admin/users/{user_id}", headers=admin)
        assert response.status_code == 200
        assert response.json()["email"] == email
        assert response.json()["role"] == "patient"
        assert response.json()["is_reviewer"] is True

        # List + filtro por rol y busqueda
        response = client.get(
            "/admin/users",
            params={"role": "patient", "search": email},
            headers=admin,
        )
        assert response.status_code == 200
        assert any(item["id"] == user_id for item in response.json()["users"])

        # Update email + quitar acceso de revision
        new_email = _unique("crud2")
        response = client.patch(
            f"/admin/users/{user_id}",
            json={"email": new_email, "is_reviewer": False},
            headers=admin,
        )
        assert response.status_code == 200, response.text
        assert response.json()["email"] == new_email
        assert response.json()["role"] == "patient"
        assert response.json()["is_reviewer"] is False

        # La cuenta actualizada puede iniciar sesion
        assert client.post(
            "/auth/login", json={"email": new_email, "password": "CrudPass123!"}
        ).status_code == 200

        # Delete
        deleted_id = user_id
        response = client.delete(f"/admin/users/{user_id}", headers=admin)
        assert response.status_code == 204
        user_id = None
        assert client.get(f"/admin/users/{deleted_id}", headers=admin).status_code == 404
    finally:
        _delete_user(admin, user_id)


def test_reviewer_permissions_and_patient_capability():
    admin = _admin_headers()
    email = _unique("revperm")
    user_id = None
    try:
        user_id = _create_user(admin, email, "RevPass123!", "patient", is_reviewer=True)
        headers = _auth(_login(email, "RevPass123!"))

        # Revisor: puede revisar postulaciones, no administrar el resto
        assert client.get("/doctors/applications", headers=headers).status_code == 200
        assert client.get("/admin/marketplace/overview", headers=headers).status_code == 403
        assert client.get("/admin/users", headers=headers).status_code == 403

        # Revisor tambien puede ser paciente
        assert client.get("/favorites/my", headers=headers).status_code == 200
        assert client.get("/appointments/my", headers=headers).status_code == 200
    finally:
        _delete_user(admin, user_id)


def test_reviewer_can_also_be_doctor_and_patient():
    admin = _admin_headers()
    email = _unique("revdoc")
    user_id = None
    try:
        # Cuenta paciente -> se le da acceso de revision (flag independiente del rol)
        response = client.post(
            "/auth/register", json={"email": email, "password": "RevDoc123!"}
        )
        assert response.status_code == 201
        user_id = response.json()["user"]["id"]
        response = client.patch(
            f"/admin/users/{user_id}", json={"is_reviewer": True}, headers=admin
        )
        assert response.status_code == 200
        assert response.json()["role"] == "patient"
        assert response.json()["is_reviewer"] is True

        # Se postula como medico (el flag de revisor se mantiene)
        specialty_id = _first_specialty_id()
        response = client.post(
            "/auth/register/doctor",
            json=_doctor_payload(email, "RevDoc123!", specialty_id),
        )
        assert response.status_code == 201, response.text
        assert response.json()["user"]["role"] == "doctor"
        assert response.json()["user"]["doctor_status"] == "pending"
        assert response.json()["user"]["is_reviewer"] is True

        _approve_doctor(admin, response.json()["access_token"])

        token = _login(email, "RevDoc123!")
        headers = _auth(token)

        # Las tres capacidades conviven
        assert client.get("/doctors/me/application", headers=headers).status_code == 200
        assert client.get("/doctors/applications", headers=headers).status_code == 200
        assert client.get("/favorites/my", headers=headers).status_code == 200

        login_payload = client.post(
            "/auth/login", json={"email": email, "password": "RevDoc123!"}
        ).json()
        assert login_payload["user"]["role"] == "doctor"
        assert login_payload["user"]["doctor_status"] == "approved"
        assert login_payload["user"]["is_reviewer"] is True

        # Revocar el acceso de revision mantiene el rol medico
        assert client.delete(f"/admin/reviewers/{user_id}", headers=admin).status_code == 204
        login_payload = client.post(
            "/auth/login", json={"email": email, "password": "RevDoc123!"}
        ).json()
        assert login_payload["user"]["role"] == "doctor"
        assert login_payload["user"]["doctor_status"] == "approved"
        assert login_payload["user"]["is_reviewer"] is False
    finally:
        _delete_user(admin, user_id)


def test_doctor_can_act_as_patient():
    admin = _admin_headers()
    email = _unique("docpat")
    user_id = None
    try:
        specialty_id = _first_specialty_id()
        response = client.post(
            "/auth/register/doctor",
            json=_doctor_payload(email, "DocPat123!", specialty_id),
        )
        assert response.status_code == 201, response.text
        user_id = response.json()["user"]["id"]

        _approve_doctor(admin, response.json()["access_token"])

        headers = _auth(_login(email, "DocPat123!"))
        # Medico
        assert client.get("/doctors/me/application", headers=headers).status_code == 200
        # Y paciente a la vez
        assert client.get("/favorites/my", headers=headers).status_code == 200
        assert client.get("/appointments/my", headers=headers).status_code == 200
    finally:
        _delete_user(admin, user_id)


def test_admin_user_safeguards():
    admin = _admin_headers()
    me = client.get("/auth/me", headers=admin).json()

    # No puede eliminarse a si mismo
    assert client.delete(f"/admin/users/{me['id']}", headers=admin).status_code == 400
    # No puede cambiarse su propio rol
    assert client.patch(
        f"/admin/users/{me['id']}", json={"role": "patient"}, headers=admin
    ).status_code == 400
    # No se puede crear un medico sin perfil medico
    response = client.post(
        "/admin/users",
        json={"email": _unique("nodoc"), "password": "NoDocPass123!", "role": "doctor"},
        headers=admin,
    )
    assert response.status_code == 400
