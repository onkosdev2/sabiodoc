from fastapi import APIRouter, Depends, Request, status

from app.core.deps import get_current_user_optional
from app.core.rate_limit import client_identifier, enforce_rate_limit
from app.models.user import User
from app.schemas.error_log import ClientErrorReport, ClientErrorReportResponse
from app.services.error_log_service import error_log_service

router = APIRouter(prefix="/client-errors", tags=["client-errors"])


@router.post(
    "/client-error",
    response_model=ClientErrorReportResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def report_client_error(
    payload: ClientErrorReport,
    request: Request,
    current_user: User | None = Depends(get_current_user_optional),
):
    """Recibe errores que solo ocurren en el navegador (Jitsi, permisos, etc.).

    Es tolerante a fallos y está limitado por IP para evitar abusos. Si el
    usuario tiene sesión, se asocia el error a su cuenta.
    """
    enforce_rate_limit(
        f"client-error:{client_identifier(request)}",
        max_requests=30,
        window_seconds=60,
    )

    details = error_log_service.request_details(request)
    error_log_service.record(
        message=payload.message,
        level=payload.level,
        source="client",
        error_type=payload.error_type or "ClientError",
        stack_trace=payload.stack,
        user_id=current_user.id if current_user else None,
        user_email=current_user.email if current_user else None,
        user_role=(
            (current_user.primary_role.value)
            if current_user
            else None
        ),
        video_session_id=payload.video_session_id,
        appointment_id=payload.appointment_id,
        consultation_id=payload.consultation_id,
        context=payload.context,
        method=details.get("method"),
        path=details.get("path"),
        ip_address=details.get("ip_address"),
        user_agent=details.get("user_agent"),
        request_id=details.get("request_id"),
    )

    return ClientErrorReportResponse(request_id=details.get("request_id"))
