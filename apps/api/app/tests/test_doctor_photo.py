"""Registro de especialista y foto de perfil del médico."""

import uuid

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services import doctor_photo_service

client = TestClient(app)


def _specialty_ids() -> list[int]:
    response = client.get("/specialties")
    assert response.status_code == 200
    specialties = response.json()["specialties"]
    assert specialties
    return [specialties[0]["id"]]


def _register_doctor(**overrides) -> dict:
    unique = uuid.uuid4().hex[:8]
    payload = {
        "email": f"docphoto_{unique}@example.com",
        "password": "testpassword123",
        "display_name": "Dr. Foto Prueba",
        "professional_title": "Medico especialista",
        "bio_short": "Perfil de prueba.",
        "price_per_min_cents": 2000,
        "license_number": "CMP 12345",
        "license_country": "Peru",
        "specialist_registry_number": "RNE 67890",
        "country": "Peru",
        "city": "Lima",
        "timezone": "America/Lima",
        "government_id": "DNI 12345678",
        "years_experience": 8,
        "specialty_ids": _specialty_ids(),
    }
    payload.update(overrides)
    response = client.post("/auth/register/doctor", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _enable_cloudinary(monkeypatch) -> None:
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "demo")
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", "key")
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", "secret")


def _fake_upload(public_id: str = "sabiodoc/doctors/doctor-1"):
    return {
        "resource_type": "image",
        "format": "jpg",
        "bytes": 20,
        "url": f"http://res.cloudinary.com/demo/image/upload/{public_id}.jpg",
        "secure_url": f"https://res.cloudinary.com/demo/image/upload/{public_id}.jpg",
        "public_id": public_id,
    }


def test_registro_medico_guarda_registro_de_especialista():
    data = _register_doctor()
    headers = _auth_headers(data["access_token"])

    application = client.get("/doctors/me/application", headers=headers)
    assert application.status_code == 200, application.text
    body = application.json()
    assert body["specialist_registry_number"] == "RNE 67890"
    assert body["photo_url"] is None


def test_actualizar_perfil_guarda_registro_de_especialista():
    data = _register_doctor()
    headers = _auth_headers(data["access_token"])

    updated = client.put(
        "/doctors/me/profile",
        headers=headers,
        json={
            "display_name": "Dr. Foto Editado",
            "professional_title": "Medico especialista",
            "bio_short": "Perfil actualizado.",
            "price_per_min_cents": 2500,
            "license_number": "CMP 55555",
            "license_country": "Peru",
            "specialist_registry_number": "RNE 99999",
            "country": "Peru",
            "city": "Lima",
            "timezone": "America/Lima",
            "government_id": "DNI 12345678",
            "years_experience": 9,
            "specialty_ids": _specialty_ids(),
        },
    )
    assert updated.status_code == 200, updated.text

    application = client.get("/doctors/me/application", headers=headers)
    assert application.json()["specialist_registry_number"] == "RNE 99999"


def test_subir_y_eliminar_foto_de_medico(monkeypatch):
    _enable_cloudinary(monkeypatch)
    monkeypatch.setattr(
        doctor_photo_service.cloudinary.uploader,
        "upload",
        lambda *a, **k: _fake_upload(),
    )
    destroyed: list[str] = []
    monkeypatch.setattr(
        doctor_photo_service.cloudinary.uploader,
        "destroy",
        lambda public_id, **k: destroyed.append(public_id) or {"result": "ok"},
    )

    data = _register_doctor()
    headers = _auth_headers(data["access_token"])

    upload = client.post(
        "/doctors/me/photo",
        headers=headers,
        files={"file": ("foto.jpg", b"imagen-de-prueba", "image/jpeg")},
    )
    assert upload.status_code == 201, upload.text
    assert upload.json()["photo_url"].endswith(".jpg")

    # La foto queda disponible en la postulación (que es lo mismo que ve el revisor).
    application = client.get("/doctors/me/application", headers=headers)
    assert application.json()["photo_url"] == upload.json()["photo_url"]

    delete = client.delete("/doctors/me/photo", headers=headers)
    assert delete.status_code == 204
    assert destroyed, "se debió borrar la imagen en Cloudinary"

    application = client.get("/doctors/me/application", headers=headers)
    assert application.json()["photo_url"] is None


def test_rechaza_archivo_que_no_es_imagen(monkeypatch):
    _enable_cloudinary(monkeypatch)

    data = _register_doctor()
    headers = _auth_headers(data["access_token"])

    upload = client.post(
        "/doctors/me/photo",
        headers=headers,
        files={"file": ("receta.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert upload.status_code == 400
    assert "imagen" in upload.json()["detail"].lower()


def test_foto_falla_si_cloudinary_no_esta_configurado(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", None)
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", None)
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", None)

    data = _register_doctor()
    headers = _auth_headers(data["access_token"])

    upload = client.post(
        "/doctors/me/photo",
        headers=headers,
        files={"file": ("foto.png", b"imagen", "image/png")},
    )
    assert upload.status_code == 503
