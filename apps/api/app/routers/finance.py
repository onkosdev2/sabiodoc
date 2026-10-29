from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_admin
from app.models.user import User
from app.schemas.finance import (
    CommissionListResponse,
    FinanceMovementListResponse,
    FinanceOverviewResponse,
    FinancePolicyResponse,
)
from app.services.finance_service import finance_service

router = APIRouter(prefix="/finance", tags=["finance"])
admin_router = APIRouter(prefix="/admin/finance", tags=["finance"])


@router.get("/policy", response_model=FinancePolicyResponse)
def get_finance_policy(current_user: User = Depends(get_current_user)):
    """Comisión vigente de la plataforma y límites de tarifa (para el médico)."""
    return FinancePolicyResponse(**finance_service.policy())


@admin_router.get("/overview", response_model=FinanceOverviewResponse)
def get_finance_overview(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Cobros, comisión de la plataforma, ingresos y payouts."""
    return FinanceOverviewResponse(**finance_service.overview(db, start=start, end=end))


@admin_router.get("/transactions", response_model=FinanceMovementListResponse)
def list_finance_movements(
    type: str | None = Query(default=None, description="initial, extension, refund, payout"),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    search: str | None = Query(default=None, description="Filtrar por correo del usuario"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Todos los movimientos de pago (cobros, ampliaciones, reembolsos y payouts)."""
    return FinanceMovementListResponse(
        **finance_service.movements(
            db,
            movement_type=type,
            start=start,
            end=end,
            search=search,
            limit=limit,
            offset=offset,
        )
    )


@admin_router.get("/commissions", response_model=CommissionListResponse)
def list_platform_commissions(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Ganancias por comisión, detalladas por cita cobrada."""
    return CommissionListResponse(
        **finance_service.commissions(db, start=start, end=end, limit=limit, offset=offset)
    )
