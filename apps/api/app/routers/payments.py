from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.payment import (
    PaymentConfigResponse,
    PaymentMethodCreateRequest,
    PaymentMethodResponse,
    SetupIntentResponse,
)
from app.services.payments.method_service import PaymentMethodError, payment_method_service

router = APIRouter(prefix="/payments", tags=["payments"])


def _handle_error(error: PaymentMethodError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))


@router.get("/config", response_model=PaymentConfigResponse)
def get_payment_config(current_user: User = Depends(get_current_user)):
    return payment_method_service.config()


@router.post("/setup-intent", response_model=SetupIntentResponse)
def create_setup_intent(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = payment_method_service.create_setup_intent(db, current_user)
    except PaymentMethodError as error:
        raise _handle_error(error) from error
    return SetupIntentResponse(
        provider=result.get("provider", "mock"),
        client_secret=result["client_secret"],
        status=result["status"],
    )


@router.get("/methods", response_model=list[PaymentMethodResponse])
def list_payment_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        methods = payment_method_service.list_methods(db, current_user)
    except PaymentMethodError as error:
        raise _handle_error(error) from error
    return [
        PaymentMethodResponse(
            id=method.id,
            brand=method.brand,
            last4=method.last4,
            exp_month=method.exp_month,
            exp_year=method.exp_year,
            is_default=method.is_default,
            status=method.status.value,
            created_at=method.created_at,
        )
        for method in methods
    ]


@router.post("/methods", response_model=PaymentMethodResponse, status_code=status.HTTP_201_CREATED)
def add_payment_method(
    payload: PaymentMethodCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        method = payment_method_service.add_method(
            db,
            current_user,
            token=payload.token,
            make_default=payload.make_default,
        )
    except PaymentMethodError as error:
        raise _handle_error(error) from error
    return PaymentMethodResponse(
        id=method.id,
        brand=method.brand,
        last4=method.last4,
        exp_month=method.exp_month,
        exp_year=method.exp_year,
        is_default=method.is_default,
        status=method.status.value,
        created_at=method.created_at,
    )


@router.post("/methods/{method_id}/default", response_model=PaymentMethodResponse)
def set_default_payment_method(
    method_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        method = payment_method_service.set_default(db, current_user, method_id)
    except PaymentMethodError as error:
        raise _handle_error(error) from error
    return PaymentMethodResponse(
        id=method.id,
        brand=method.brand,
        last4=method.last4,
        exp_month=method.exp_month,
        exp_year=method.exp_year,
        is_default=method.is_default,
        status=method.status.value,
        created_at=method.created_at,
    )


@router.delete("/methods/{method_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment_method(
    method_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        payment_method_service.remove(db, current_user, method_id)
    except PaymentMethodError as error:
        raise _handle_error(error) from error
