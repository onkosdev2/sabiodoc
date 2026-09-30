from sqlalchemy import Column, Integer, String, DateTime, Enum, Boolean
from sqlalchemy.sql import func
from app.db.base import Base
import enum


class UserRole(str, enum.Enum):
    patient = "patient"
    doctor = "doctor"
    reviewer = "reviewer"
    admin = "admin"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.patient, nullable=False)
    # Capacidad independiente del rol: permite ser medico y revisor a la vez.
    is_reviewer = Column(Boolean, nullable=False, server_default="false")
    # La cuenta debe verificar su correo antes de iniciar sesión (excepto cuentas
    # creadas por admin/seed o cuando la verificación está desactivada).
    is_email_verified = Column(Boolean, nullable=False, server_default="true", default=True)
    # Se incrementa al cambiar la contraseña para invalidar los tokens emitidos.
    session_version = Column(Integer, nullable=False, server_default="1")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
