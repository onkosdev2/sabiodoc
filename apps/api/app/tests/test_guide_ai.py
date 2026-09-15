from fastapi.testclient import TestClient

from app.main import app
from app.services import guide_service as guide_module

client = TestClient(app)


def _answer(question_id: str, question: str, value: str, label: str) -> dict:
    return {
        "question_id": question_id,
        "question": question,
        "answer": value,
        "answer_label": label,
    }


def test_guide_step_uses_ai_question_and_filters_options(monkeypatch):
    def fake_chat_json(**kwargs):
        return {
            "status": "question",
            "question": "¿Dónde sientes principalmente las molestias?",
            "options": [
                {"value": "pecho", "label": "En el pecho"},
                {"value": "cabeza", "label": "En la cabeza"},
                {"value": "abdomen", "label": "En el abdomen"},
                {"value": "", "label": "Opción inválida sin value"},
            ],
        }

    monkeypatch.setattr(guide_module.llm_client, "chat_json", fake_chat_json)

    response = client.post("/guide/step", json={"history": []})

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "question"
    assert data["question_id"] == "ai_q1"
    assert len(data["options"]) == 3
    assert all(option["value"] and option["label"] for option in data["options"])


def test_guide_step_ai_recommendation_is_validated(monkeypatch):
    def fake_chat_json(**kwargs):
        return {
            "status": "recommendation",
            "recommended_specialty_slug": "cardiologia",
            "confidence": "alta",
            "reason": "Tus respuestas sugieren una evaluación cardiovascular.",
            "rationale_bullets": ["Dolor en el pecho", "Antecedentes familiares"],
            "alternatives": [
                {"specialty_slug": "medicina-interna", "reason": "Evaluación general"},
                {"specialty_slug": "especialidad-inexistente", "reason": "No existe"},
            ],
            "urgency": "high",
            "red_flags_detected": ["Dolor torácico"],
        }

    monkeypatch.setattr(guide_module.llm_client, "chat_json", fake_chat_json)

    history = [_answer("ai_q1", "¿Dónde?", "pecho", "En el pecho")]
    response = client.post("/guide/step", json={"history": history})

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "recommendation"
    assert data["recommended_specialty_slug"] == "cardiologia"
    assert data["recommended_specialty_name"]
    assert data["urgency"] == "high"
    assert data["confidence"] == "alta"
    assert data["disclaimer"]
    alternative_slugs = [alt["specialty_slug"] for alt in data["alternatives"]]
    assert "especialidad-inexistente" not in alternative_slugs


def test_guide_step_ai_invalid_specialty_falls_back(monkeypatch):
    def fake_chat_json(**kwargs):
        return {
            "status": "recommendation",
            "recommended_specialty_slug": "especialidad-que-no-existe",
            "reason": "Motivo de prueba",
            "urgency": "medium",
        }

    monkeypatch.setattr(guide_module.llm_client, "chat_json", fake_chat_json)

    response = client.post("/guide/step", json={"history": []})

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "recommendation"
    assert data["recommended_specialty_slug"] == "medicina-interna"


def test_joint_history_includes_triage_and_guide():
    import uuid

    email = f"history_{uuid.uuid4().hex[:8]}@example.com"
    register = client.post(
        "/auth/register",
        json={"email": email, "password": "testpassword123"},
    )
    assert register.status_code == 201
    headers = {"Authorization": f"Bearer {register.json()['access_token']}"}

    # 1) Describir Mi Caso
    triage = client.post(
        "/ai/triage",
        json={"symptoms_text": "Tengo dolor de cabeza desde hace 3 dias y mareos"},
        headers=headers,
    )
    assert triage.status_code == 200

    # 2) Guía IA (modo mock: 4 preguntas deterministas)
    history = []
    for _ in range(6):
        response = client.post("/guide/step", json={"history": history}, headers=headers)
        data = response.json()
        if data["status"] == "recommendation":
            break
        option = data["options"][0]
        history.append(_answer(data["question_id"], data["question"], option["value"], option["label"]))

    # 3) Historial conjunto
    response = client.get("/ai/history", headers=headers)
    assert response.status_code == 200
    items = response.json()
    sources = {item["source"] for item in items}
    assert "triage" in sources
    assert "guide" in sources
    assert all(item["result"]["recommended_specialty_slug"] for item in items)


def test_joint_history_requires_authentication():
    response = client.get("/ai/history")
    assert response.status_code == 401
