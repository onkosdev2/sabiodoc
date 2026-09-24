"""Tests del health-check de proveedores LLM (DeepSeek + fallback Groq)."""

from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.main import app
from app.services.llm_client import llm_client

client = TestClient(app)


class _FakeModels:
    def __init__(self, error: Exception | None = None):
        self._error = error

    def list(self, **kwargs):
        if self._error:
            raise self._error
        return SimpleNamespace(data=[])


class _FakeClient:
    def __init__(self, error: Exception | None = None):
        self.models = _FakeModels(error=error)


def _set_providers(providers, is_mock=False):
    llm_client.providers = providers
    llm_client.is_mock = is_mock


def _restore(state):
    llm_client.providers, llm_client.is_mock = state


def test_llm_health_check_ok():
    state = (llm_client.providers, llm_client.is_mock)
    try:
        _set_providers([("deepseek", _FakeClient(), "deepseek-chat")])
        result = llm_client.health_check()
        assert result["healthy"] is True
        assert result["mode"] == "live"
        assert result["providers"][0]["status"] == "ok"
        assert result["providers"][0]["name"] == "deepseek"
    finally:
        _restore(state)


def test_llm_health_check_reports_error():
    state = (llm_client.providers, llm_client.is_mock)
    try:
        _set_providers(
            [("deepseek", _FakeClient(error=TimeoutError("timeout")), "deepseek-chat")]
        )
        result = llm_client.health_check()
        assert result["healthy"] is False
        assert result["providers"][0]["status"] == "error"
        assert "timeout" in result["providers"][0]["detail"]
    finally:
        _restore(state)


def test_llm_health_check_fallback_still_healthy():
    state = (llm_client.providers, llm_client.is_mock)
    try:
        _set_providers(
            [
                ("deepseek", _FakeClient(error=ConnectionError("down")), "deepseek-chat"),
                ("groq", _FakeClient(), "llama-3.3-70b-versatile"),
            ]
        )
        result = llm_client.health_check()
        assert result["healthy"] is True
        statuses = {item["name"]: item["status"] for item in result["providers"]}
        assert statuses == {"deepseek": "error", "groq": "ok"}
    finally:
        _restore(state)


def test_llm_health_check_mock_mode():
    state = (llm_client.providers, llm_client.is_mock)
    try:
        _set_providers([], is_mock=True)
        result = llm_client.health_check()
        assert result["healthy"] is True
        assert result["mode"] == "mock"
        assert result["providers"] == []
    finally:
        _restore(state)


def test_llm_health_endpoint_shape():
    state = (llm_client.providers, llm_client.is_mock)
    try:
        _set_providers([("deepseek", _FakeClient(), "deepseek-chat")])
        response = client.get("/health/llm")
        assert response.status_code == 200
        body = response.json()
        assert body["healthy"] is True
        assert body["providers"][0]["name"] == "deepseek"
    finally:
        _restore(state)


def test_admin_ai_status_requiere_admin_y_devuelve_estado():
    # Sin token -> no autorizado.
    assert client.get("/admin/ai/status").status_code in (401, 403)

    state = (llm_client.providers, llm_client.is_mock)
    try:
        _set_providers([("deepseek", _FakeClient(), "deepseek-chat")])
        login = client.post(
            "/auth/login",
            json={"email": "admin.demo@sabiodoc.app", "password": "AdminDemo123!"},
        )
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]

        response = client.get(
            "/admin/ai/status", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json()["providers"][0]["name"] == "deepseek"
    finally:
        _restore(state)
