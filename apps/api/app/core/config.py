from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://sabiodoc:sabiodoc_secret@localhost:5432/sabiodoc_db"
    
    JWT_SECRET: str = "your-super-secret-jwt-key-change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_MODEL: str = "deepseek-chat"

    FRONTEND_ORIGIN: str = "http://localhost:5173"
    DAILY_API_KEY: Optional[str] = None
    DAILY_BASE_URL: str = "https://api.daily.co/v1"
    DAILY_DOMAIN: str = "https://sabiodoc.daily.co"
    DAILY_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_CURRENCY: str = "usd"
    VIDEO_PRICE_MIN_CENTS: int = 500
    VIDEO_PRICE_MAX_CENTS: int = 30000
    VIDEO_MIN_PREPAY_MINUTES: int = 15
    VIDEO_PREPARE_EXPIRATION_MINUTES: int = 20
    APPOINTMENT_BUFFER_MINUTES: int = 10
    NO_SHOW_GRACE_MINUTES: int = 10
    VIDEO_CONSENT_VERSION: str = "v1"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
