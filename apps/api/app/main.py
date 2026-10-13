import time
import traceback
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.services.error_log_service import error_log_service
from app.services.llm_client import llm_client
from app.routers import admin, appointments, auth, client_errors, consultations, doctors, favorites, files, finance, guide, notifications, patients, specialties, support, triage, video_sessions, webhooks, emergency, wallet, reviews

setup_logging()
logger = get_logger(__name__)

app = FastAPI(
    title="SabioDoc API",
    description="API de orientación médica inteligente",
    version="1.0.0",
    # En producción no exponemos la documentación interactiva.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Rutas cuyo 4xx sí nos interesa registrar (fallos de videoconsulta).
_VIDEO_PATH_MARKERS = ("/video-sessions", "/video-session")


def _is_video_path(path: str) -> bool:
    return any(marker in path for marker in _VIDEO_PATH_MARKERS)


def _should_capture(status_code: int, path: str) -> bool:
    """Captura todos los 5xx y los 4xx relevantes de videoconsulta."""
    if status_code >= 500:
        return True
    if status_code in {400, 403, 409, 422} and _is_video_path(path):
        return True
    return False


def _capture_request_error(
    request: Request,
    *,
    message: str,
    status_code: int | None = None,
    error_type: str | None = None,
    stack_trace: str | None = None,
    level: str = "error",
    context: dict | None = None,
) -> None:
    details = error_log_service.request_details(request)
    user_id, user_email, user_role = error_log_service.resolve_request_user(request)
    error_log_service.record(
        message=message,
        status_code=status_code,
        error_type=error_type,
        stack_trace=stack_trace,
        level=level,
        user_id=user_id,
        user_email=user_email,
        user_role=user_role,
        context=context,
        **details,
    )


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    """Adjunta un identificador único a cada petición.

    Se reutiliza el ``X-Request-ID`` del cliente si viene y se devuelve en la
    respuesta para poder cruzar lo que vio el usuario con el error registrado.
    También registra las peticiones que tardan demasiado.
    """
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    request.state.request_id = request_id
    started_at = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    response.headers["X-Request-ID"] = request_id
    if elapsed_ms > 5000:
        logger.warning(
            f"Petición lenta: {request.method} {request.url.path} "
            f"tardó {elapsed_ms:.0f} ms (request_id={request_id})"
        )
    return response


app.include_router(auth.router)
app.include_router(specialties.router)
app.include_router(triage.router)
app.include_router(guide.router)
app.include_router(consultations.router)
app.include_router(favorites.router)
app.include_router(files.router)
app.include_router(doctors.router)
app.include_router(reviews.router)
app.include_router(patients.router)
app.include_router(appointments.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(wallet.router)
app.include_router(video_sessions.router)
app.include_router(emergency.router)
app.include_router(client_errors.router)
app.include_router(finance.router)
app.include_router(finance.admin_router)
app.include_router(webhooks.router)
app.include_router(support.router)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Registra los errores HTTP relevantes sin cambiar la respuesta al cliente."""
    if _should_capture(exc.status_code, request.url.path):
        detail = exc.detail if isinstance(exc.detail, str) else jsonable_encoder(exc.detail)
        _capture_request_error(
            request,
            message=str(detail),
            status_code=exc.status_code,
            error_type="HTTPException",
            level="warning" if exc.status_code < 500 else "error",
            context={"detail": detail},
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Mantiene el formato de error de validación y reporta los de videoconsulta."""
    errors = jsonable_encoder(exc.errors())
    if _is_video_path(request.url.path):
        _capture_request_error(
            request,
            message="Error de validación en la petición de videoconsulta",
            status_code=422,
            error_type="RequestValidationError",
            level="warning",
            context={"errors": errors},
        )
    return JSONResponse(status_code=422, content={"detail": errors})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    _capture_request_error(
        request,
        message=str(exc) or type(exc).__name__,
        status_code=500,
        error_type=type(exc).__name__,
        stack_trace="".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
        context={
            "query_params": dict(request.query_params),
            "origin": request.headers.get("origin"),
        },
    )
    # FastAPI asigna este handler al ServerErrorMiddleware, que queda por fuera
    # del CORSMiddleware. Agregamos las cabeceras CORS a mano para que el
    # navegador pueda leer el 500 en lugar de reportar un error de CORS.
    headers: dict[str, str] = {}
    origin = request.headers.get("origin")
    if origin and origin in settings.cors_origins:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor"},
        headers=headers,
    )


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "sabiodoc-api"}


@app.get("/health/llm")
def llm_health_check():
    """Estado de los proveedores de IA (DeepSeek y su fallback Groq)."""
    return llm_client.health_check()


@app.get("/")
def root():
    return {
        "message": "Bienvenido a SabioDoc API",
        "docs": "/docs",
        "health": "/health"
    }
