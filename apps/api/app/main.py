from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.services.llm_client import llm_client
from app.routers import admin, appointments, auth, consultations, doctors, favorites, guide, notifications, patients, specialties, triage, video_sessions, emergency, wallet

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

app.include_router(auth.router)
app.include_router(specialties.router)
app.include_router(triage.router)
app.include_router(guide.router)
app.include_router(consultations.router)
app.include_router(favorites.router)
app.include_router(doctors.router)
app.include_router(patients.router)
app.include_router(appointments.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(wallet.router)
app.include_router(video_sessions.router)
app.include_router(emergency.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor"}
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
