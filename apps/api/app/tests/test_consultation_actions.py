"""Cierre manual y eliminación de borradores de consulta IA."""

import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.chat_message import ChatMessage
from app.models.consultation import Consultation, ConsultationStatus
from app.models.specialty import Specialty

client = TestClient(app)

PATIENT_EMAIL = "paciente.demo@sabiodoc.app"
PATIENT_PASSWORD = "PatientDemo123!"


def _headers() -> dict:
    response = client.post("/auth/login", json={"email": PATIENT_EMAIL, "password": PATIENT_PASSWORD})
    if response.status_code != 200:
        pytest.skip("El paciente demo no esta disponible en la base de datos")
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _specialty_id(slug: str) -> int:
    db = SessionLocal()
    try:
        specialty = db.query(Specialty).filter(Specialty.slug == slug).first()
        assert specialty is not None, f"Especialidad {slug} no encontrada"
        return specialty.id
    finally:
        db.close()


def _delete_rows(ids: list[int]) -> None:
    if not ids:
        return
    db = SessionLocal()
    try:
        db.query(ChatMessage).filter(ChatMessage.consultation_id.in_(ids)).delete(
            synchronize_session=False
        )
        db.query(Consultation).filter(Consultation.id.in_(ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def test_close_and_delete_draft_consultation():
    headers = _headers()
    specialty_id = _specialty_id("dermatologia")
    created_ids: list[int] = []
    try:
        # 1) Un borrador se puede eliminar.
        draft = client.post("/consultations", json={"specialty_id": specialty_id}, headers=headers)
        assert draft.status_code == 201, draft.text
        draft_id = draft.json()["id"]
        created_ids.append(draft_id)

        delete_response = client.delete(f"/consultations/{draft_id}", headers=headers)
        assert delete_response.status_code == 204, delete_response.text

        # 2) Una consulta se puede finalizar manualmente...
        another = client.post("/consultations", json={"specialty_id": specialty_id}, headers=headers)
        assert another.status_code == 201, another.text
        another_id = another.json()["id"]
        created_ids.append(another_id)

        close_response = client.post(f"/consultations/{another_id}/close", headers=headers)
        assert close_response.status_code == 200, close_response.text
        body = close_response.json()
        assert body["status"] == "closed"
        assert body["auto_closed"] is False
        assert body["closed_at"] is not None

        # ...pero una consulta finalizada ya no se puede eliminar (protege historial).
        blocked = client.delete(f"/consultations/{another_id}", headers=headers)
        assert blocked.status_code == 409, blocked.text
    finally:
        _delete_rows(created_ids)


def test_delete_active_consultation_is_blocked():
    headers = _headers()
    specialty_id = _specialty_id("dermatologia")
    created_ids: list[int] = []
    db = SessionLocal()
    try:
        created = client.post("/consultations", json={"specialty_id": specialty_id}, headers=headers)
        assert created.status_code == 201, created.text
        consultation_id = created.json()["id"]
        created_ids.append(consultation_id)

        # Sin llamar al LLM: marcamos la consulta como activa directamente.
        db.query(Consultation).filter(Consultation.id == consultation_id).update(
            {"status": ConsultationStatus.active}, synchronize_session=False
        )
        db.commit()

        blocked = client.delete(f"/consultations/{consultation_id}", headers=headers)
        assert blocked.status_code == 409, blocked.text
    finally:
        _delete_rows(created_ids)
        db.close()
