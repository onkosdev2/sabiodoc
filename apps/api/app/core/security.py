from datetime import UTC, datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
import re

from app.core.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verificar contraseña usando bcrypt directamente."""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )


def get_password_hash(password: str) -> str:
    """Hashear contraseña usando bcrypt directamente."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def validate_password_strength(password: str) -> str:
    """Valida la política mínima de contraseñas y devuelve la contraseña.

    Reglas: 8-128 caracteres, al menos una letra y al menos un número.
    Pensada para usarse en validadores de Pydantic (lanza ValueError).
    """
    if len(password) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres.")
    if len(password) > 128:
        raise ValueError("La contraseña no puede superar los 128 caracteres.")
    if not re.search(r"[A-Za-z]", password):
        raise ValueError("La contraseña debe incluir al menos una letra.")
    if not re.search(r"\d", password):
        raise ValueError("La contraseña debe incluir al menos un número.")
    return password


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(UTC)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
