"""Webhooks de la pasarela de payouts."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_webhook_con_firma_invalida_es_rechazado():
    # El proveedor mock no verifica firmas, por lo que cualquier webhook se
    # rechaza; con Stripe se exige una firma válida.
    response = client.post("/webhooks/payouts/stripe", json={"type": "transfer.paid"})
    assert response.status_code == 400
