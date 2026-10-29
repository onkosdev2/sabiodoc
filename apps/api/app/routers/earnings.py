from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, get_doctor_profile_or_403, require_admin
from app.models.user import User
from app.schemas.earnings import (
    EarningItem,
    EarningsSummary,
    PayoutItem,
    PayoutRequest,
    ReconciliationResponse,
)
from app.services.earnings_service import EarningsError, earnings_service

router = APIRouter(prefix="/earnings", tags=["earnings"])


def _payout_item(payout) -> PayoutItem:
    return PayoutItem(
        id=payout.id,
        amount_cents=payout.amount_cents,
        currency=payout.currency,
        provider=payout.provider,
        provider_reference=payout.provider_reference,
        status=payout.status.value,
        failure_reason=payout.failure_reason,
        requested_at=payout.requested_at,
        processed_at=payout.processed_at,
    )


@router.get("/me", response_model=EarningsSummary)
def get_my_earnings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = get_doctor_profile_or_403(db, current_user, require_approved=True)
    return EarningsSummary(**earnings_service.summary(db, doctor.id))


@router.get("/me/items", response_model=list[EarningItem])
def list_my_earnings(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = get_doctor_profile_or_403(db, current_user, require_approved=True)
    return [
        EarningItem(
            id=item.id,
            appointment_id=item.appointment_id,
            gross_cents=item.gross_cents,
            platform_fee_cents=item.platform_fee_cents,
            net_cents=item.net_cents,
            status=item.status.value,
            available_at=item.available_at,
            created_at=item.created_at,
        )
        for item in earnings_service.list_earnings(db, doctor.id, limit)
    ]


@router.get("/me/payouts", response_model=list[PayoutItem])
def list_my_payouts(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = get_doctor_profile_or_403(db, current_user, require_approved=True)
    return [_payout_item(item) for item in earnings_service.list_payouts(db, doctor.id, limit)]


@router.post("/me/payouts", response_model=PayoutItem, status_code=status.HTTP_201_CREATED)
def request_my_payout(
    payload: PayoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = get_doctor_profile_or_403(db, current_user, require_approved=True)
    try:
        payout = earnings_service.request_payout(db, doctor.id, payload.amount_cents)
    except EarningsError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return _payout_item(payout)


@router.get("/admin/payouts", response_model=list[PayoutItem])
def admin_list_payouts(
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return [_payout_item(item) for item in earnings_service.list_payouts(db, None, limit)]


@router.post("/admin/payouts/{payout_id}/retry", response_model=PayoutItem)
def admin_retry_payout(
    payout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        payout = earnings_service.retry_payout(db, payout_id)
    except EarningsError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return _payout_item(payout)


@router.get("/admin/reconciliation", response_model=ReconciliationResponse)
def admin_reconciliation(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return ReconciliationResponse(**earnings_service.reconcile(db))
