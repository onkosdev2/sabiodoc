"""Webhooks de la pasarela de payouts.

El proveedor confirma de forma asíncrona si el dinero llegó a la cuenta del
usuario. Este endpoint valida la firma, actualiza el retiro y, si falla,
devuelve los créditos. Es idempotente: los reintentos del proveedor no afectan
un retiro ya resuelto.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.core.logging import get_logger
from app.services.payout_service import payout_service
from app.services.wallet_service import wallet_service

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = get_logger(__name__)

# Eventos de Stripe Transfers -> estado interno del retiro.
_EVENT_STATUS = {
    "transfer.paid": "paid",
    "transfer.failed": "failed",
    "transfer.reversed": "failed",
    "payout.paid": "paid",
    "payout.failed": "failed",
}


@router.post("/payouts/{provider}", status_code=status.HTTP_200_OK)
async def payout_webhook(
    provider: str,
    request: Request,
    db: Session = Depends(get_db),
):
    payload = await request.body()
    headers = {key.lower(): value for key, value in request.headers.items()}

    event = payout_service.verify_webhook(payload, headers)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook no válido o firma incorrecta",
        )

    event_type = event.get("type", "")
    new_status = _EVENT_STATUS.get(event_type)
    obj = (event.get("data") or {}).get("object") or {}
    reference = obj.get("id")

    if new_status is None or not reference:
        # Evento que no nos interesa: se responde 200 para que el proveedor no reintente.
        return {"status": "ignored", "event": event_type}

    failure_reason = None
    if new_status == "failed":
        failure_reason = (
            obj.get("failure_message")
            or obj.get("failure_code")
            or "El proveedor no pudo completar el retiro"
        )

    withdrawal = wallet_service.handle_payout_event(
        db,
        provider_reference=reference,
        status=new_status,
        failure_reason=failure_reason,
    )
    if withdrawal is None:
        logger.warning(f"Webhook de payout sin retiro asociado: ref={reference} event={event_type}")
        return {"status": "not_found", "reference": reference}

    db.commit()
    logger.info(f"Payout webhook aplicado: ref={reference} event={event_type} status={withdrawal.status.value}")
    return {"status": withdrawal.status.value, "reference": reference}
