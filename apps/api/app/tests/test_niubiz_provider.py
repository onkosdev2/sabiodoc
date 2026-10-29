"""Scaffolding del adaptador Niubiz."""

import pytest

from app.core.config import settings
from app.services.payments.factory import get_payment_provider
from app.services.payments.niubiz_provider import NiubizNotConfiguredError


def test_factory_devuelve_niubiz(monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "niubiz")
    provider = get_payment_provider()
    assert provider.name == "niubiz"


def test_sin_credenciales_falla_con_mensaje_claro(monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "niubiz")
    monkeypatch.setattr(settings, "NIUBIZ_MERCHANT_ID", None)
    provider = get_payment_provider()
    with pytest.raises(NiubizNotConfiguredError):
        provider.create_customer(user_id=1, email="ana@example.com")
