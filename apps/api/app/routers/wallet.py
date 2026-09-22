from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.user import User
from app.models.wallet import Withdrawal
from app.schemas.wallet import (
    WalletResponse,
    WalletTopupRequest,
    WalletTransactionsResponse,
    WalletWithdrawRequest,
    WithdrawalListResponse,
    WithdrawalResponse,
)
from app.services.wallet_service import wallet_service

router = APIRouter(prefix="/wallet", tags=["wallet"])
logger = get_logger(__name__)


@router.get("/me", response_model=WalletResponse)
def get_my_wallet(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Saldo de créditos y movimientos recientes del usuario actual."""
    payload = wallet_service.build_wallet_response(db, current_user.id, limit=limit)
    response = WalletResponse.model_validate(payload)
    db.commit()
    return response


@router.get("/me/transactions", response_model=WalletTransactionsResponse)
def get_my_transactions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transactions, total = wallet_service.list_transactions(
        db, current_user.id, limit=limit, offset=offset
    )
    response = WalletTransactionsResponse.model_validate(
        {"transactions": transactions, "total": total}
    )
    return response


@router.post("/topup", response_model=WalletResponse, status_code=status.HTTP_201_CREATED)
def topup_credits(
    payload: WalletTopupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recarga de créditos con dinero de prueba (sin pasarela real todavía)."""
    wallet_service.topup(db, current_user.id, payload.amount_cents)
    response = WalletResponse.model_validate(
        wallet_service.build_wallet_response(db, current_user.id)
    )
    db.commit()
    return response


@router.post("/withdraw", response_model=WithdrawalResponse, status_code=status.HTTP_201_CREATED)
def request_withdrawal(
    payload: WalletWithdrawRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Solicita convertir créditos en dinero real hacia una cuenta."""
    withdrawal = wallet_service.request_withdrawal(
        db,
        current_user.id,
        amount_cents=payload.amount_cents,
        destination=payload.destination,
    )
    response = WithdrawalResponse.model_validate(withdrawal)
    db.commit()
    return response


@router.get("/me/withdrawals", response_model=WithdrawalListResponse)
def get_my_withdrawals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    withdrawals = (
        db.query(Withdrawal)
        .filter(Withdrawal.user_id == current_user.id)
        .order_by(Withdrawal.created_at.desc())
        .all()
    )
    return WithdrawalListResponse(
        withdrawals=[WithdrawalResponse.model_validate(item) for item in withdrawals],
        total=len(withdrawals),
    )
