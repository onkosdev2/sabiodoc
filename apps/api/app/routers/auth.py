from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import UTC, datetime, timedelta
import hashlib
import secrets

from app.core.config import settings
from app.core.deps import get_db, get_current_user
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.password_reset_token import PasswordResetToken
from app.models.user import UserRole
from app.models.doctor_presence import DoctorPresence, DoctorPresenceStatus
from app.models.doctor_specialty import DoctorSpecialty
from app.models.user import User
from app.schemas.user import (
    DoctorRegistrationCreate,
    ForgotPasswordRequest,
    MessageResponse,
    ResetPasswordRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.core.logging import get_logger
from app.core.rate_limit import enforce_rate_limit, rate_limit_dependency
from app.services.doctor_onboarding_service import doctor_onboarding_service
from app.services.email_service import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)

# Límites anti fuerza bruta (por IP).
register_rate_limit = rate_limit_dependency("auth:register", max_requests=10, window_seconds=3600)
login_rate_limit = rate_limit_dependency("auth:login", max_requests=10, window_seconds=300)
forgot_password_rate_limit = rate_limit_dependency("auth:forgot-password", max_requests=5, window_seconds=3600)
reset_password_rate_limit = rate_limit_dependency("auth:reset-password", max_requests=10, window_seconds=3600)
# Además del límite por IP, limitamos por cuenta para frenar ataques dirigidos.
LOGIN_MAX_ATTEMPTS_PER_EMAIL = 5
LOGIN_EMAIL_WINDOW_SECONDS = 300


def _issue_access_token(user: User) -> str:
    """Token con el id del usuario y su versión de sesión (para revocación)."""
    return create_access_token(data={"sub": str(user.id), "ver": user.session_version or 1})


def build_user_response(user: User) -> UserResponse:
    doctor_profile = getattr(user, "doctor_profile", None)
    patient_profile = getattr(user, "patient_profile", None)

    doctor_name = doctor_profile.display_name if doctor_profile and doctor_profile.display_name else None
    patient_name = None
    if patient_profile and (patient_profile.first_name or patient_profile.last_name):
        patient_name = " ".join(
            part for part in [patient_profile.first_name, patient_profile.last_name] if part
        ).strip() or None

    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        doctor_status=doctor_profile.status if doctor_profile else None,
        is_reviewer=bool(user.is_reviewer),
        display_name=doctor_name or patient_name,
        doctor_display_name=doctor_name,
        patient_display_name=patient_name,
        created_at=user.created_at,
    )

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(register_rate_limit)],
)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado"
        )
    
    user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    logger.info("New user registered: id=%s", user.id)
    
    access_token = _issue_access_token(user)
    
    return TokenResponse(
        access_token=access_token,
        user=build_user_response(user)
    )


@router.post(
    "/register/doctor",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(register_rate_limit)],
)
def register_doctor(doctor_data: DoctorRegistrationCreate, db: Session = Depends(get_db)):
    
    # 1. Buscamos si el usuario ya existe
    existing_user = db.query(User).filter(User.email == doctor_data.email).first()
    
    if existing_user:
        # Si ya es doctor, lo bloqueamos (ya tiene perfil medico)
        if existing_user.role == UserRole.doctor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El email ya está registrado como médico"
            )

        # Verificamos la contraseña de la cuenta existente.
        if not verify_password(doctor_data.password, existing_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="El email ya está registrado. Contraseña incorrecta."
            )

        # Un paciente se promueve a doctor para habilitar su panel medico.
        # Un admin o revisor conserva su rol y gana la capacidad medica mediante
        # su DoctorProfile (modelo de capacidades aditivas).
        if existing_user.role == UserRole.patient:
            existing_user.role = UserRole.doctor
        user = existing_user
    else:
        # Si no existe, creamos el usuario desde cero
        user = User(
            email=doctor_data.email,
            password_hash=get_password_hash(doctor_data.password),
            role=UserRole.doctor,
        )
        db.add(user)
    
    # IMPORTANTE: Este flush va una sola vez, después del bloque if/else
    db.flush()

    # Evitamos duplicar el perfil si una cuenta admin/revisor vuelve a postularse.
    existing_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un perfil médico para esta cuenta",
        )

    # 2. Validamos servicios de onboarding
    doctor_onboarding_service.validate_price_or_raise(doctor_data.price_per_min_cents)
    specialties = doctor_onboarding_service.resolve_specialties(db, doctor_data.specialty_ids)

    # 3. Creamos el perfil médico apuntando al ID del usuario
    doctor_profile = DoctorProfile(
        user_id=user.id,
        display_name=doctor_data.display_name,
        professional_title=doctor_data.professional_title,
        bio_short=doctor_data.bio_short,
        price_per_min_cents=doctor_data.price_per_min_cents,
        license_number=doctor_data.license_number,
        license_country=doctor_data.license_country,
        country=doctor_data.country,
        city=doctor_data.city,
        timezone=doctor_data.timezone,
        government_id=doctor_data.government_id,
        years_experience=doctor_data.years_experience,
        is_accepting_consultations=True,
        status=DoctorApprovalStatus.pending,
    )
    db.add(doctor_profile)
    db.flush()

    # 4. Agregamos las especialidades
    for specialty in specialties:
        db.add(DoctorSpecialty(doctor_id=doctor_profile.id, specialty_id=specialty.id))

    # 5. Inicializamos su estado de conexión
    db.add(
        DoctorPresence(
            doctor_id=doctor_profile.id,
            status=DoctorPresenceStatus.offline,
            status_message="Desconectado",
        )
    )

    db.commit()
    db.refresh(user)

    logger.info(f"New doctor application registered/upgraded: {user.email}")

    access_token = _issue_access_token(user)

    return TokenResponse(
        access_token=access_token,
        user=build_user_response(user)
    )


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(login_rate_limit)])
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    enforce_rate_limit(
        f"auth:login-email:{credentials.email.lower()}",
        max_requests=LOGIN_MAX_ATTEMPTS_PER_EMAIL,
        window_seconds=LOGIN_EMAIL_WINDOW_SECONDS,
    )

    user = db.query(User).filter(User.email == credentials.email).first()
    
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos"
        )
    
    logger.info("User logged in: id=%s", user.id)
    
    access_token = _issue_access_token(user)
    
    return TokenResponse(
        access_token=access_token,
        user=build_user_response(user)
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return build_user_response(current_user)


PASSWORD_RESET_MESSAGE = (
    "Si el correo está registrado, te enviaremos instrucciones para restablecer tu contraseña."
)


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    dependencies=[Depends(forgot_password_rate_limit)],
)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Solicita el restablecimiento. Responde igual exista o no el correo."""
    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        token = secrets.token_urlsafe(32)
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=_hash_reset_token(token),
                expires_at=datetime.now(UTC)
                + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_MINUTES),
            )
        )
        db.commit()

        reset_url = f"{settings.primary_frontend_origin}/reset-password?token={token}"
        try:
            send_password_reset_email(user.email, reset_url)
        except Exception:
            logger.exception("No se pudo enviar el correo de restablecimiento")

    return MessageResponse(message=PASSWORD_RESET_MESSAGE)


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    dependencies=[Depends(reset_password_rate_limit)],
)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_hash = _hash_reset_token(payload.token)
    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .with_for_update()
        .first()
    )
    now = datetime.now(UTC)
    if not record or record.used_at is not None or record.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El enlace de restablecimiento es inválido o expiró.",
        )

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El enlace de restablecimiento es inválido o expiró.",
        )

    user.password_hash = get_password_hash(payload.new_password)
    # Invalida los tokens emitidos antes del cambio de contraseña.
    user.session_version = (user.session_version or 1) + 1
    # Marca este token y cualquier otro pendiente del usuario como usados.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": now}, synchronize_session=False)
    db.commit()
    logger.info("Password reset completed: id=%s", user.id)
    return MessageResponse(message="Contraseña actualizada. Ya puedes iniciar sesión.")
