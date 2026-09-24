"""Favoritos de médicos (antes eran de especialidades)."""

import uuid

from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.main import app
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.favorite import Favorite
from app.models.user import User, UserRole

client = TestClient(app)


def test_flujo_de_favoritos_de_medico():
    db = SessionLocal()
    doctor = (
        db.query(DoctorProfile)
        .filter(DoctorProfile.status == DoctorApprovalStatus.approved)
        .first()
    )
    assert doctor is not None
    doctor_id = doctor.id

    patient = User(
        email=f"fav_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="x",
        role=UserRole.patient,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    token = create_access_token(data={"sub": str(patient.id), "ver": patient.session_version or 1})
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # Añadir
        response = client.post("/favorites", json={"doctor_id": doctor_id}, headers=headers)
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["doctor_id"] == doctor_id
        assert body["doctor"]["id"] == doctor_id

        # Duplicado -> 400
        assert (
            client.post("/favorites", json={"doctor_id": doctor_id}, headers=headers).status_code
            == 400
        )

        # Listado con el médico
        listing = client.get("/favorites/my", headers=headers)
        assert listing.status_code == 200
        assert listing.json()["total"] == 1
        assert listing.json()["favorites"][0]["doctor"]["id"] == doctor_id

        # Quitar
        assert client.delete(f"/favorites/{doctor_id}", headers=headers).status_code == 204
        assert client.get("/favorites/my", headers=headers).json()["total"] == 0

        # Médico inexistente -> 404
        assert (
            client.post("/favorites", json={"doctor_id": 99999999}, headers=headers).status_code
            == 404
        )
    finally:
        db.query(Favorite).filter(Favorite.user_id == patient.id).delete(synchronize_session=False)
        db.query(User).filter(User.id == patient.id).delete(synchronize_session=False)
        db.commit()
        db.close()
