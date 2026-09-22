"""Validación de configuración (producción) y política de contraseñas."""

import pytest
from pydantic import ValidationError

from app.core.config import DEFAULT_JWT_SECRET, Settings
from app.schemas.user import UserCreate, UserLogin


def _settings(**overrides) -> Settings:
    # `_env_file=None` hace el test hermético (no lee el .env del proyecto).
    return Settings(_env_file=None, **overrides)


def test_desarrollo_permite_origenes_locales():
    settings = _settings(ENVIRONMENT="development", FRONTEND_ORIGIN="http://localhost:5173")

    assert settings.is_production is False
    assert "http://localhost:5173" in settings.cors_origins
    assert "http://localhost:3000" in settings.cors_origins


def test_produccion_rechaza_el_secreto_por_defecto():
    with pytest.raises(ValidationError):
        _settings(
            ENVIRONMENT="production",
            JWT_SECRET=DEFAULT_JWT_SECRET,
            FRONTEND_ORIGIN="https://app.example",
        )


def test_produccion_rechaza_un_secreto_corto():
    with pytest.raises(ValidationError):
        _settings(
            ENVIRONMENT="production",
            JWT_SECRET="corto",
            FRONTEND_ORIGIN="https://app.example",
        )


def test_produccion_usa_solo_los_origenes_configurados():
    settings = _settings(
        ENVIRONMENT="production",
        JWT_SECRET="x" * 40,
        FRONTEND_ORIGIN="https://app.example, https://admin.example",
    )

    assert settings.is_production is True
    assert settings.cors_origins == ["https://app.example", "https://admin.example"]


def test_registro_exige_contrasena_minima():
    with pytest.raises(ValidationError):
        UserCreate(email="ana@example.com", password="corta")

    assert UserCreate(email="ana@example.com", password="secreta123").password == "secreta123"


def test_login_acepta_contrasenas_legadas_cortas():
    # No imponemos longitud mínima al iniciar sesión para no bloquear cuentas
    # creadas antes del endurecimiento de la política.
    assert UserLogin(email="ana@example.com", password="seis66").password == "seis66"
