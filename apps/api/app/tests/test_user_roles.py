"""Tests del modelo de roles múltiples.

Un usuario tiene un conjunto de roles; ``patient`` es el base y
``doctor``/``reviewer``/``admin`` son sumables. Cubren:
- Un revisor puede revisar postulaciones y además ser paciente.
- Un revisor puede ser también médico (roles reviewer + doctor).
- Un médico puede actuar como paciente.
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


def _create_user(admin: dict, email: str, password: str, roles: list[str]) -> int:
    response = client.post(
        "/admin/users",
        json={"email": email, "password": password, "roles": roles},
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
        user_id = _create_user(admin, email, "CrudPass123!", ["patient", "reviewer"])

        # Read
        response = client.get(f"/admin/users/{user_id}", headers=admin)
        assert response.status_code == 200
        assert response.json()["email"] == email
        assert set(response.json()["roles"]) == {"patient", "reviewer"}

        # List + filtro por rol y busqueda
        response = client.get(
            "/admin/users",
            params={"role": "reviewer", "search": email},
            headers=admin,
        )
        assert response.status_code == 200
        assert any(item["id"] == user_id for item in response.json()["users"])

        # Update email + quitar acceso de revision (sin tocar el rol base)
        new_email = _unique("crud2")
        response = client.patch(
            f"/admin/users/{user_id}",
            json={"email": new_email, "roles": ["patient"]},
            headers=admin,
        )
        assert response.status_code == 200, response.text
        assert response.json()["email"] == new_email
        assert set(response.json()["roles"]) == {"patient"}

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
        user_id = _create_user(admin, email, "RevPass123!", ["patient", "reviewer"])
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
        # Cuenta paciente -> se le suma el rol de revisor.
        response = client.post(
            "/auth/register", json={"email": email, "password": "RevDoc123!"}
        )
        assert response.status_code == 201
        user_id = response.json()["user"]["id"]
        response = client.patch(
            f"/admin/users/{user_id}", json={"roles": ["patient", "reviewer"]}, headers=admin
        )
        assert response.status_code == 200
        assert set(response.json()["roles"]) == {"patient", "reviewer"}

        # Se postula como medico: se SUMA el rol de doctor (no reemplaza).
        specialty_id = _first_specialty_id()
        response = client.post(
            "/auth/register/doctor",
            json=_doctor_payload(email, "RevDoc123!", specialty_id),
        )
        assert response.status_code == 201, response.text
        assert set(response.json()["user"]["roles"]) == {"patient", "doctor", "reviewer"}
        assert response.json()["user"]["doctor_status"] == "pending"

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
        assert set(login_payload["user"]["roles"]) == {"patient", "doctor", "reviewer"}
        assert login_payload["user"]["doctor_status"] == "approved"

        # Revocar el rol de revisor mantiene el rol medico.
        assert client.delete(f"/admin/reviewers/{user_id}", headers=admin).status_code == 204
        login_payload = client.post(
            "/auth/login", json={"email": email, "password": "RevDoc123!"}
        ).json()
        assert set(login_payload["user"]["roles"]) == {"patient", "doctor"}
        assert login_payload["user"]["doctor_status"] == "approved"
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


def test_notificacion_de_postulacion_en_espanol():
    """La notificación de aprobación no debe mostrar el valor interno en inglés."""
    admin = _admin_headers()
    email = _unique("notif")
    user_id = None
    try:
        specialty_id = _first_specialty_id()
        response = client.post(
            "/auth/register/doctor",
            json=_doctor_payload(email, "Notif123!", specialty_id),
        )
        assert response.status_code == 201, response.text
        user_id = response.json()["user"]["id"]

        _approve_doctor(admin, response.json()["access_token"])

        headers = _auth(_login(email, "Notif123!"))
        notifications = client.get("/notifications/my", headers=headers)
        assert notifications.status_code == 200, notifications.text
        bodies = [item["body"] for item in notifications.json()["notifications"]]
        assert any("como aprobado" in body for body in bodies), bodies
        assert all("approved" not in body.lower() for body in bodies), bodies
    finally:
        _delete_user(admin, user_id)


def test_admin_user_safeguards():
    admin = _admin_headers()
    me = client.get("/auth/me", headers=admin).json()

    # No puede eliminarse a si mismo
    assert client.delete(f"/admin/users/{me['id']}", headers=admin).status_code == 400
    # No puede quitarse su propio rol de administrador
    assert client.patch(
        f"/admin/users/{me['id']}", json={"roles": ["patient"]}, headers=admin
    ).status_code == 400
    # No se puede crear un medico sin perfil medico
    response = client.post(
        "/admin/users",
        json={"email": _unique("nodoc"), "password": "NoDocPass123!", "roles": ["doctor"]},
        headers=admin,
    )
    assert response.status_code == 400
