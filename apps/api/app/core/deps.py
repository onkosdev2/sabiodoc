from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.security import decode_access_token
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.user import User, UserRole

security = HTTPBearer(auto_error=False)


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se proporcionó token de autenticación"
        )
    
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido"
        )
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado"
        )
    
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Permite el acceso unicamente a administradores."""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores",
        )
    return current_user


def require_application_reviewer(current_user: User = Depends(get_current_user)) -> User:
    """Permite revisar postulaciones medicas a administradores y revisores."""
    if current_user.role not in {UserRole.admin, UserRole.reviewer}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores o revisores pueden gestionar postulaciones medicas",
        )
    return current_user


def get_doctor_profile_or_403(
    db: Session,
    user: User,
    *,
    require_approved: bool = False,
) -> DoctorProfile:
    """
    Devuelve el perfil medico del usuario sin depender de su rol principal.

    La capacidad de ejercer como medico depende de tener un DoctorProfile, no de
    que el rol sea exactamente "doctor". Asi un admin o revisor que ademas sea
    medico puede seguir usando el panel medico.
    """
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes un perfil medico",
        )
    if require_approved and profile.status != DoctorApprovalStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu perfil medico aun no esta aprobado",
        )
    return profile


def get_current_user_optional(
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[User]:
    if not credentials:
        return None
    
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        return None
    
    user_id = payload.get("sub")
    if user_id is None:
        return None
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    return user
