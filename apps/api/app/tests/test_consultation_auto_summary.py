"""Cierre automático de la pre-consulta cuando el paciente acepta el resumen."""

import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.chat_message import ChatMessage, MessageRole
from app.models.consultation import Consultation, ConsultationStatus
from app.models.specialty import Specialty
from app.services import specialist_assistant as assistant_module

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


def _create_consultation_with_history(specialty_id: int, assistant_message: str) -> int:
    headers = _headers()
    created = client.post("/consultations", json={"specialty_id": specialty_id}, headers=headers)
    assert created.status_code == 201, created.text
    consultation_id = created.json()["id"]

    db = SessionLocal()
    try:
        db.query(Consultation).filter(Consultation.id == consultation_id).update(
            {"status": ConsultationStatus.active}, synchronize_session=False
        )
        db.add(
            ChatMessage(
                consultation_id=consultation_id,
                role=MessageRole.user,
                content="Tengo picazon en el brazo desde hace una semana",
            )
        )
        db.add(
            ChatMessage(
                consultation_id=consultation_id,
                role=MessageRole.assistant,
                content=assistant_message,
            )
        )
        db.commit()
    finally:
        db.close()
    return consultation_id


def test_accepting_summary_offer_closes_consultation(monkeypatch):
    specialty_id = _specialty_id("dermatologia")
    consultation_id = _create_consultation_with_history(
        specialty_id,
        "¿Quieres que genere el resumen de esta conversación para el médico?",
    )
    try:
        got_summary = {"called": False}

        def fake_generate_summary(**_kwargs):
            got_summary["called"] = True
            return "Resumen de prueba para el medico"

        monkeypatch.setattr(
            assistant_module.specialist_assistant,
            "generate_summary",
            fake_generate_summary,
        )
        monkeypatch.setattr(
            assistant_module.specialist_assistant,
            "generate_structured_intake",
            lambda **_kwargs: {"chief_complaint": "picazon", "completeness": "partial"},
        )

        response = client.post(
            f"/consultations/{consultation_id}/chat",
            json={"message": "sí, por favor"},
            headers=_headers(),
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["summary_generated"] is True
        assert "Resumen de prueba para el medico" in body["assistant_message"]["content"]
        assert got_summary["called"] is True

        db = SessionLocal()
        try:
            db.expire_all()
            updated = db.query(Consultation).filter(Consultation.id == consultation_id).first()
            assert updated is not None
            assert updated.status == ConsultationStatus.closed
            assert updated.closed_at is not None
            assert updated.summary == "Resumen de prueba para el medico"
        finally:
            db.close()
    finally:
        _delete_rows([consultation_id])


def test_affirmative_without_summary_offer_does_not_close(monkeypatch):
    specialty_id = _specialty_id("dermatologia")
    consultation_id = _create_consultation_with_history(
        specialty_id,
        "¿Desde cuándo notas la picazón?",
    )
    try:
        monkeypatch.setattr(
            assistant_module.specialist_assistant,
            "chat",
            lambda **_kwargs: "Gracias, seguimos.",
        )

        response = client.post(
            f"/consultations/{consultation_id}/chat",
            json={"message": "sí"},
            headers=_headers(),
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["summary_generated"] is False

        db = SessionLocal()
        try:
            db.expire_all()
            updated = db.query(Consultation).filter(Consultation.id == consultation_id).first()
            assert updated is not None
            assert updated.status != ConsultationStatus.closed
            assert updated.summary is None
        finally:
            db.close()
    finally:
        _delete_rows([consultation_id])
