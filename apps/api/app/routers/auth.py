from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.doctor_profile import DoctorApprovalStatus, DoctorProfile
from app.models.user import UserRole
from app.models.doctor_presence import DoctorPresence, DoctorPresenceStatus
from app.models.doctor_specialty import DoctorSpecialty
from app.models.user import User
from app.schemas.user import DoctorRegistrationCreate, UserCreate, UserLogin, UserResponse, TokenResponse
from app.core.logging import get_logger
from app.services.doctor_onboarding_service import doctor_onboarding_service

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)


def build_user_response(user: User) -> UserResponse:
    doctor_profile = getattr(user, "doctor_profile", None)
    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        doctor_status=doctor_profile.status if doctor_profile else None,
        created_at=user.created_at,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
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
    
    logger.info(f"New user registered: {user.email}")
    
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return TokenResponse(
        access_token=access_token,
        user=build_user_response(user)
    )


@router.post("/register/doctor", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_doctor(doctor_data: DoctorRegistrationCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == doctor_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado"
        )

    doctor_onboarding_service.validate_price_or_raise(doctor_data.price_per_min_cents)
    specialties = doctor_onboarding_service.resolve_specialties(db, doctor_data.specialty_ids)

    user = User(
        email=doctor_data.email,
        password_hash=get_password_hash(doctor_data.password),
        role=UserRole.doctor,
    )
    db.add(user)
    db.flush()

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

    for specialty in specialties:
        db.add(DoctorSpecialty(doctor_id=doctor_profile.id, specialty_id=specialty.id))

    db.add(
        DoctorPresence(
            doctor_id=doctor_profile.id,
            status=DoctorPresenceStatus.offline,
            status_message="Desconectado",
        )
    )

    db.commit()
    db.refresh(user)

    logger.info(f"New doctor application registered: {user.email}")

    access_token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        user=build_user_response(user)
    )


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos"
        )
    
    logger.info(f"User logged in: {user.email}")
    
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return TokenResponse(
        access_token=access_token,
        user=build_user_response(user)
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return build_user_response(current_user)
