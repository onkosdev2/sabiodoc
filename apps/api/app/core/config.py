from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

DEFAULT_JWT_SECRET = "your-super-secret-jwt-key-change-this-in-production"

# Orígenes locales permitidos en desarrollo. En producción solo se usa
# `FRONTEND_ORIGIN` (admite varios separados por comas).
_DEV_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:9091",
    "http://127.0.0.1:9091",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.84:5173",
]


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    # Confiar en X-Forwarded-For solo si hay un proxy inverso delante.
    TRUST_PROXY_HEADERS: bool = False
    DATABASE_URL: str = "postgresql://sabiodoc:sabiodoc_secret@localhost:55432/sabiodoc_db"
    
    JWT_SECRET: str = DEFAULT_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Recuperación de contraseña
    PASSWORD_RESET_TOKEN_MINUTES: int = 30
    # SMTP opcional: si no se configura, en desarrollo se registra el enlace.
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: Optional[str] = None
    SMTP_USE_TLS: bool = True
    
    # DeepSeek AI Integration
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_MODEL: str = "deepseek-chat"

    # Groq AI (fallback si DeepSeek falla, no responde o tarda demasiado)
    GROQ_API_KEY: Optional[str] = None
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Resiliencia del LLM
    LLM_TIMEOUT_SECONDS: float = 8.0

    FRONTEND_ORIGIN: str = "http://localhost:5173"
    # Jitsi self-hosted (videoconsultas)
    JITSI_DOMAIN: str = "192.168.1.123:7443"
    JITSI_BASE_URL: str = "https://192.168.1.123:7443"
    JITSI_ROOM_PREFIX: str = "SabioDoc"
    JITSI_JWT_APP_ID: str = "sabiodoc"
    JITSI_JWT_AUDIENCE: str = "jitsi"
    JITSI_JWT_SECRET: Optional[str] = None
    
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_CURRENCY: str = "usd"
    
    VIDEO_PRICE_MIN_CENTS: int = 10
    VIDEO_PRICE_MAX_CENTS: int = 30000
    VIDEO_MIN_PREPAY_MINUTES: int = 15
    VIDEO_PREPARE_EXPIRATION_MINUTES: int = 20
    APPOINTMENT_BUFFER_MINUTES: int = 10
    NO_SHOW_GRACE_MINUTES: int = 10
    VIDEO_CONSENT_VERSION: str = "v1"
    # El cronometro solo corre cuando ambos estan en la sala. Si un participante
    # deja de dar senales por mas de este tiempo, el cronometro se pausa.
    VIDEO_PRESENCE_TIMEOUT_SECONDS: int = 30
    # Minimo facturable cuando la sesion estuvo activa (evita cobros de 0).
    VIDEO_MIN_BILLABLE_MINUTES: int = 1
    # Si una sesion activa se queda sin nadie en la sala durante este tiempo,
    # se cierra y liquida automaticamente.
    VIDEO_SESSION_ABANDON_MINUTES: int = 5

    # Borradores de consulta IA: se cierran automaticamente si no registran
    # actividad (mensajes) en este tiempo. 168 h = 7 dias.
    CONSULTATION_DRAFT_TTL_HOURS: int = 168

    # Presencia de medicos: se considera "activo" si tuvo actividad en esta ventana.
    DOCTOR_PRESENCE_ONLINE_MINUTES: int = 5

    # Creditos (dinero de pruebas): 1 credito = 1 USD = 100 centavos.
    CREDITS_CURRENCY: str = "usd"
    WALLET_MIN_TOPUP_CENTS: int = 500
    WALLET_MAX_TOPUP_CENTS: int = 100000
    WALLET_MIN_WITHDRAWAL_CENTS: int = 1000
    # Comision de la plataforma sobre cada cita, en puntos basicos (100 = 1%).
    PLATFORM_FEE_BPS: int = 0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() in {"production", "prod"}

    @property
    def primary_frontend_origin(self) -> str:
        """Primer origen del frontend, para construir enlaces (p. ej. reset)."""
        origins = [origin.strip() for origin in self.FRONTEND_ORIGIN.split(",") if origin.strip()]
        return origins[0] if origins else "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        """Orígenes permitidos por CORS (en dev incluye los locales habituales)."""
        configured = [origin.strip() for origin in self.FRONTEND_ORIGIN.split(",") if origin.strip()]
        if self.is_production:
            return configured
        return list(dict.fromkeys(configured + _DEV_ORIGINS))

    @model_validator(mode="after")
    def _validate_production_settings(self):
        """Evita arrancar en producción con secretos inseguros o sin CORS."""
        if not self.is_production:
            return self
        if self.JWT_SECRET == DEFAULT_JWT_SECRET or len(self.JWT_SECRET) < 32:
            raise ValueError(
                "JWT_SECRET debe ser un valor único de al menos 32 caracteres en producción"
            )
        if not [origin for origin in self.FRONTEND_ORIGIN.split(",") if origin.strip()]:
            raise ValueError("FRONTEND_ORIGIN debe estar configurado en producción")
        return self


settings = Settings()