"""Foto de perfil de los médicos (Cloudinary).

Reutiliza la misma cuenta de Cloudinary que los archivos de videoconsulta, pero
en una carpeta propia. Cada médico tiene una única foto: se sobrescribe el mismo
`public_id`, de modo que no se acumulan imágenes huérfanas.
"""

import io

import cloudinary
import cloudinary.uploader
from cloudinary.exceptions import AuthorizationRequired, NotAllowed
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.doctor_profile import DoctorProfile

logger = get_logger(__name__)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


def _configure_cloudinary() -> None:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def _photo_public_id(doctor_profile: DoctorProfile) -> str:
    return f"{settings.CLOUDINARY_DOCTOR_FOLDER}/doctor-{doctor_profile.id}"


def _destroy_cloudinary_image(public_id: str) -> None:
    if not public_id:
        return
    try:
        _configure_cloudinary()
        cloudinary.uploader.destroy(public_id, resource_type="image", invalidate=True)
    except Exception as exc:  # pragma: no cover - depende del proveedor externo
        logger.warning(f"No se pudo borrar la foto en Cloudinary ({public_id}): {exc}")


def upload_doctor_photo(
    db: Session, doctor_profile: DoctorProfile, upload: UploadFile
) -> DoctorProfile:
    if not settings.cloudinary_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La carga de fotos no está configurada (Cloudinary).",
        )

    content_type = (upload.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La foto debe ser una imagen JPG, PNG o WEBP.",
        )

    data = upload.file.read()
    if len(data) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La imagen está vacía.")
    max_bytes = settings.DOCTOR_PHOTO_MAX_MB * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La imagen supera el límite de {settings.DOCTOR_PHOTO_MAX_MB} MB.",
        )

    _configure_cloudinary()
    public_id = _photo_public_id(doctor_profile)
    previous_public_id = doctor_profile.photo_public_id
    original_name = upload.filename or f"doctor-{doctor_profile.id}"
    buffer = io.BytesIO(data)
    buffer.name = original_name
    try:
        result = cloudinary.uploader.upload(
            buffer,
            folder=settings.CLOUDINARY_DOCTOR_FOLDER,
            public_id=f"doctor-{doctor_profile.id}",
            resource_type="image",
            overwrite=True,
            invalidate=True,
            # Recorte cuadrado centrado en el rostro para una tarjeta uniforme.
            transformation=[
                {"width": 480, "height": 480, "crop": "fill", "gravity": "face"},
                {"quality": "auto", "fetch_format": "auto"},
            ],
        )
    except (AuthorizationRequired, NotAllowed) as exc:
        logger.error(f"Cloudinary authorization/config error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "La configuración de Cloudinary no es válida. "
                "Revisa CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET."
            ),
        ) from exc
    except Exception as exc:  # pragma: no cover - depende del proveedor externo
        logger.error(f"Cloudinary doctor photo upload failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No se pudo subir la foto. Intenta de nuevo.",
        ) from exc

    doctor_profile.photo_url = result.get("secure_url") or result.get("url") or ""
    doctor_profile.photo_public_id = result.get("public_id") or public_id
    db.commit()
    db.refresh(doctor_profile)

    # Si existía una foto previa con otro public_id, la eliminamos.
    if previous_public_id and previous_public_id != doctor_profile.photo_public_id:
        _destroy_cloudinary_image(previous_public_id)

    logger.info(f"Doctor photo uploaded: doctor_profile_id={doctor_profile.id}")
    return doctor_profile


def delete_doctor_photo(db: Session, doctor_profile: DoctorProfile) -> None:
    public_id = doctor_profile.photo_public_id
    doctor_profile.photo_url = None
    doctor_profile.photo_public_id = None
    db.commit()
    db.refresh(doctor_profile)

    if public_id:
        _destroy_cloudinary_image(public_id)

    logger.info(f"Doctor photo deleted: doctor_profile_id={doctor_profile.id}")
