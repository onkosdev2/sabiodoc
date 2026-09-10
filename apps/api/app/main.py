from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.routers import admin, appointments, auth, consultations, doctors, favorites, guide, notifications, specialties, triage, video_sessions, webhooks

setup_logging()
logger = get_logger(__name__)

app = FastAPI(
    title="SabioDoc API",
    description="API de orientación médica inteligente",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:9091",
        "http://127.0.0.1:9091",
        "http://192.168.1.84:5173",
        "http://localhost:3000",
    ],
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
app.include_router(appointments.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(video_sessions.router)
app.include_router(webhooks.router)


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


@app.get("/")
def root():
    return {
        "message": "Bienvenido a SabioDoc API",
        "docs": "/docs",
        "health": "/health"
    }
