from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://sabiodoc:sabiodoc_secret@localhost:55432/sabiodoc_db"
    
    JWT_SECRET: str = "your-super-secret-jwt-key-change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
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
    
    VIDEO_PRICE_MIN_CENTS: int = 500
    VIDEO_PRICE_MAX_CENTS: int = 30000
    VIDEO_MIN_PREPAY_MINUTES: int = 15
    VIDEO_PREPARE_EXPIRATION_MINUTES: int = 20
    APPOINTMENT_BUFFER_MINUTES: int = 10
    NO_SHOW_GRACE_MINUTES: int = 10
    VIDEO_CONSENT_VERSION: str = "v1"

    # Borradores de consulta IA: se cierran automaticamente si no registran
    # actividad (mensajes) en este tiempo. 168 h = 7 dias.
    CONSULTATION_DRAFT_TTL_HOURS: int = 168

    # Presencia de medicos: se considera "activo" si tuvo actividad en esta ventana.
    DOCTOR_PRESENCE_ONLINE_MINUTES: int = 5

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()