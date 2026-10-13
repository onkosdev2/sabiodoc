"""Registro de errores: reportes del navegador, captura de 500 y panel de admin."""

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services.error_log_service import error_log_service

client = TestClient(app)
# Para inspeccionar el 500 en lugar de que el TestClient lo re-lance.
safe_client = TestClient(app, raise_server_exceptions=False)


def _admin_headers() -> dict:
    login = client.post(
        "/auth/login",
        json={"email": "admin.demo@sabiodoc.app", "password": "AdminDemo123!"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_client_error_se_guarda_y_sanitiza():
    response = client.post(
        "/client-errors/client-error",
        json={
            "message": "No se pudo cargar la videollamada de Jitsi",
            "error_type": "JitsiLoadError",
            "level": "error",
            "video_session_id": 4242,
            "appointment_id": 77,
            "context": {
                "room_name": "SabioDoc-1-abc",
                "password": "supersecreto",
                "nested": {"jwt": "abc.def.ghi"},
            },
        },
    )
    assert response.status_code == 202, response.text
    assert response.json()["request_id"]

    headers = _admin_headers()
    listing = client.get("/admin/error-logs?source=client&video_only=true", headers=headers)
    assert listing.status_code == 200, listing.text
    payload = listing.json()
    assert payload["total"] >= 1
    item = payload["items"][0]
    assert item["source"] == "client"
    assert item["video_session_id"] == 4242
    assert item["occurrences"] >= 1

    detail = client.get(f"/admin/error-logs/{item['id']}", headers=headers)
    assert detail.status_code == 200
    context = detail.json()["context"]
    assert context["password"] == "[REDACTED]"
    assert context["nested"]["jwt"] == "[REDACTED]"
    assert context["room_name"] == "SabioDoc-1-abc"


def test_excepcion_no_controlada_se_registra(monkeypatch):
    def _boom():
        raise RuntimeError("fallo simulado del proveedor")

    monkeypatch.setattr("app.services.llm_client.llm_client.health_check", _boom)

    response = safe_client.get("/health/llm")
    assert response.status_code == 500

    headers = _admin_headers()
    listing = client.get("/admin/error-logs?source=backend&search=fallo simulado", headers=headers)
    assert listing.status_code == 200
    payload = listing.json()
    assert payload["total"] >= 1

    detail = client.get(f"/admin/error-logs/{payload['items'][0]['id']}", headers=headers)
    assert detail.status_code == 200
    body = detail.json()
    assert body["error_type"] == "RuntimeError"
    assert body["status_code"] == 500
    assert "Traceback" in (body["stack_trace"] or "")


def test_eliminar_error_individual():
    report = client.post(
        "/client-errors/client-error",
        json={"message": "permiso de camara denegado", "error_type": "NotAllowedError"},
    )
    assert report.status_code == 202
    headers = _admin_headers()
    listing = client.get("/admin/error-logs?search=permiso de camara", headers=headers)
    item = listing.json()["items"][0]

    deleted = client.delete(f"/admin/error-logs/{item['id']}", headers=headers)
    assert deleted.status_code == 204
    assert client.get(f"/admin/error-logs/{item['id']}", headers=headers).status_code == 404


def test_eliminar_errores_en_masa():
    for index in range(3):
        created = client.post(
            "/client-errors/client-error",
            json={"message": f"bulk error {index}", "error_type": "BulkError"},
        )
        assert created.status_code == 202

    headers = _admin_headers()
    listing = client.get("/admin/error-logs?search=bulk error", headers=headers)
    ids = [item["id"] for item in listing.json()["items"]]
    assert len(ids) >= 3

    response = client.post("/admin/error-logs/bulk-delete", json={"ids": ids}, headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["deleted"] == len(ids)

    after = client.get("/admin/error-logs?search=bulk error", headers=headers)
    assert after.json()["total"] == 0


def test_solo_admin_puede_ver_errores():
    assert client.get("/admin/error-logs").status_code in (401, 403)

    import uuid

    email = f"patient_errors_{uuid.uuid4().hex[:8]}@example.com"
    register = client.post(
        "/auth/register",
        json={"email": email, "password": "testpassword123"},
    )
    assert register.status_code == 201, register.text
    patient_headers = {"Authorization": f"Bearer {register.json()['access_token']}"}
    assert client.get("/admin/error-logs", headers=patient_headers).status_code == 403


def test_fingerprint_agrupa_errores_equivalentes():
    one = error_log_service.build_fingerprint(
        source="client",
        error_type="JitsiError",
        method="POST",
        path="/client-errors/client-error",
        message="No se pudo cargar la sala 1234",
    )
    two = error_log_service.build_fingerprint(
        source="client",
        error_type="JitsiError",
        method="POST",
        path="/client-errors/client-error",
        message="No se pudo cargar la sala 9876",
    )
    assert one == two


def test_retencion_configurada():
    assert settings.ERROR_LOG_RETENTION_DAYS == 60
