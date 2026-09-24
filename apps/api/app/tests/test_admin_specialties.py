"""CRUD de especialidades desde el panel de administración."""

import uuid

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.doctor_profile import DoctorProfile
from app.models.doctor_specialty import DoctorSpecialty
from app.models.specialty import Specialty

client = TestClient(app)


def _admin_headers() -> dict:
    login = client.post(
        "/auth/login",
        json={"email": "admin.demo@sabiodoc.app", "password": "AdminDemo123!"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_crud_de_especialidades():
    headers = _admin_headers()
    slug = f"test-esp-{uuid.uuid4().hex[:6]}"
    created_ids: list[int] = []
    link_doctor_id: int | None = None

    try:
        # Crear
        response = client.post(
            "/admin/specialties",
            json={"name": "Especialidad Test", "slug": slug, "keywords": ["prueba"], "is_top": True},
            headers=headers,
        )
        assert response.status_code == 201, response.text
        specialty = response.json()
        created_ids.append(specialty["id"])
        assert specialty["slug"] == slug
        assert specialty["is_top"] is True

        # Slug duplicado -> 400
        assert (
            client.post(
                "/admin/specialties",
                json={"name": "Otra", "slug": slug},
                headers=headers,
            ).status_code
            == 400
        )

        # Listado
        listing = client.get("/admin/specialties", headers=headers)
        assert listing.status_code == 200
        assert any(item["id"] == specialty["id"] for item in listing.json()["specialties"])

        # Actualizar
        updated = client.patch(
            f"/admin/specialties/{specialty['id']}",
            json={"name": "Especialidad Editada", "is_top": False},
            headers=headers,
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["name"] == "Especialidad Editada"
        assert updated.json()["is_top"] is False

        # Eliminar una especialidad con médicos asociados -> 400
        db = SessionLocal()
        try:
            doctor = db.query(DoctorProfile).first()
            assert doctor is not None
            link_doctor_id = doctor.id
            db.add(DoctorSpecialty(doctor_id=doctor.id, specialty_id=specialty["id"]))
            db.commit()
        finally:
            db.close()

        blocked = client.delete(f"/admin/specialties/{specialty['id']}", headers=headers)
        assert blocked.status_code == 400, blocked.text

        # Quitamos el vínculo y ya se puede borrar
        db = SessionLocal()
        try:
            db.query(DoctorSpecialty).filter(
                DoctorSpecialty.specialty_id == specialty["id"]
            ).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()

        assert (
            client.delete(f"/admin/specialties/{specialty['id']}", headers=headers).status_code
            == 204
        )
        created_ids.clear()

        # Requiere admin
        assert client.get("/admin/specialties").status_code in (401, 403)
    finally:
        db = SessionLocal()
        try:
            if link_doctor_id is not None:
                db.query(DoctorSpecialty).filter(
                    DoctorSpecialty.specialty_id.in_(created_ids)
                ).delete(synchronize_session=False)
            db.query(Specialty).filter(Specialty.id.in_(created_ids)).delete(
                synchronize_session=False
            )
            db.commit()
        finally:
            db.close()
