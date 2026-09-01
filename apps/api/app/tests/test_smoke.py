import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "SabioDoc" in response.json()["message"]


def test_register_and_login():
    import uuid
    unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    
    register_response = client.post("/auth/register", json={
        "email": unique_email,
        "password": "testpassword123"
    })
    assert register_response.status_code == 201
    assert "access_token" in register_response.json()
    assert register_response.json()["user"]["email"] == unique_email
    assert register_response.json()["user"]["role"] == "patient"
    
    login_response = client.post("/auth/login", json={
        "email": unique_email,
        "password": "testpassword123"
    })
    assert login_response.status_code == 200
    assert "access_token" in login_response.json()


def test_register_doctor_application():
    import uuid

    specialties_response = client.get("/specialties")
    assert specialties_response.status_code == 200
    specialties = specialties_response.json()["specialties"]
    assert len(specialties) > 0

    unique_email = f"doctor_{uuid.uuid4().hex[:8]}@example.com"
    register_response = client.post("/auth/register/doctor", json={
        "email": unique_email,
        "password": "testpassword123",
        "display_name": "Dr. Test Onboarding",
        "professional_title": "Medico general",
        "bio_short": "Perfil de prueba para onboarding.",
        "price_per_min_cents": 2200,
        "license_number": "COL-TEST-1234",
        "license_country": "Colombia",
        "country": "Colombia",
        "city": "Bogota",
        "timezone": "America/Bogota",
        "government_id": "CC-12345678",
        "years_experience": 5,
        "specialty_ids": [specialties[0]["id"]],
    })

    assert register_response.status_code == 201
    payload = register_response.json()
    assert payload["user"]["email"] == unique_email
    assert payload["user"]["role"] == "doctor"
    assert payload["user"]["doctor_status"] == "pending"

    access_token = payload["access_token"]
    application_response = client.get(
        "/doctors/me/application",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert application_response.status_code == 200
    application = application_response.json()
    assert application["email"] == unique_email
    assert application["display_name"] == "Dr. Test Onboarding"
    assert application["status"] == "pending"
    assert application["license_number"] == "COL-TEST-1234"
    assert len(application["specialties"]) == 1


def test_list_specialties():
    response = client.get("/specialties")
    assert response.status_code == 200
    assert "specialties" in response.json()
    assert "total" in response.json()


def test_top_specialties():
    response = client.get("/specialties/top")
    assert response.status_code == 200
    assert "specialties" in response.json()


def test_search_specialties():
    response = client.get("/specialties?query=cardio")
    assert response.status_code == 200
    assert "specialties" in response.json()


def test_triage_endpoint():
    response = client.post("/ai/triage", json={
        "symptoms_text": "Tengo dolor de cabeza desde hace 3 días y me siento mareado"
    })
    assert response.status_code == 200
    result = response.json()
    assert "result" in result
    assert "urgency" in result["result"]
    assert "recommended_specialty_slug" in result["result"]
    assert "disclaimer" in result["result"]


def test_triage_emergency_detection():
    response = client.post("/ai/triage", json={
        "symptoms_text": "Tengo dolor torácico severo y no puedo respirar bien"
    })
    assert response.status_code == 200
    result = response.json()
    assert result["result"]["urgency"] in ["high", "emergency"]


def test_guide_questions():
    response = client.get("/guide/questions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) > 0


def test_guide_recommend():
    response = client.post("/guide/recommend", json={
        "answers": [
            {"question_id": "body_area", "answer": "chest"},
            {"question_id": "patient_type", "answer": "adult"},
            {"question_id": "duration", "answer": "days"},
            {"question_id": "severity", "answer": "moderate"}
        ]
    })
    assert response.status_code == 200
    result = response.json()
    assert "recommended_specialty_slug" in result
    assert "disclaimer" in result
