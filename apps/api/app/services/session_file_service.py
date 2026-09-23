"""Archivos compartidos durante la videoconsulta (Cloudinary)."""

import io
import uuid

import cloudinary
import cloudinary.uploader
from cloudinary.exceptions import AuthorizationRequired, NotAllowed
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.user import User
from app.models.video_session import VideoSession
from app.models.video_session_file import VideoSessionFile

logger = get_logger(__name__)


def _configure_cloudinary() -> None:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def _resource_type(content_type: str | None) -> str:
    if content_type:
        if content_type.startswith("image/"):
            return "image"
        if content_type.startswith("video/") or content_type.startswith("audio/"):
            return "video"
    return "raw"


def count_files_for_uploader(db: Session, video_session_id: int, uploader_id: int) -> int:
    return (
        db.query(VideoSessionFile)
        .filter(
            VideoSessionFile.video_session_id == video_session_id,
            VideoSessionFile.uploader_id == uploader_id,
        )
        .count()
    )


def list_session_files(db: Session, video_session_id: int) -> list[VideoSessionFile]:
    return (
        db.query(VideoSessionFile)
        .filter(VideoSessionFile.video_session_id == video_session_id)
        .order_by(VideoSessionFile.created_at.asc())
        .all()
    )


def list_files_for_appointment(db: Session, appointment_id: int) -> list[VideoSessionFile]:
    return (
        db.query(VideoSessionFile)
        .filter(VideoSessionFile.appointment_id == appointment_id)
        .order_by(VideoSessionFile.created_at.asc())
        .all()
    )


def list_files_grouped_by_session(
    db: Session, session_ids: list[int]
) -> dict[int, list[VideoSessionFile]]:
    if not session_ids:
        return {}
    rows = (
        db.query(VideoSessionFile)
        .filter(VideoSessionFile.video_session_id.in_(session_ids))
        .order_by(VideoSessionFile.created_at.asc())
        .all()
    )
    grouped: dict[int, list[VideoSessionFile]] = {}
    for row in rows:
        grouped.setdefault(row.video_session_id, []).append(row)
    return grouped


def list_files_grouped_by_appointment(
    db: Session, appointment_ids: list[int]
) -> dict[int, list[VideoSessionFile]]:
    if not appointment_ids:
        return {}
    rows = (
        db.query(VideoSessionFile)
        .filter(VideoSessionFile.appointment_id.in_(appointment_ids))
        .order_by(VideoSessionFile.created_at.asc())
        .all()
    )
    grouped: dict[int, list[VideoSessionFile]] = {}
    for row in rows:
        grouped.setdefault(row.appointment_id, []).append(row)
    return grouped


def upload_session_file(
    db: Session,
    video_session: VideoSession,
    uploader: User,
    uploader_role: str,
    upload: UploadFile,
) -> VideoSessionFile:
    if not settings.cloudinary_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La carga de archivos no está configurada (Cloudinary).",
        )

    existing = count_files_for_uploader(db, video_session.id, uploader.id)
    if existing >= settings.SESSION_FILES_MAX:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya enviaste el máximo de {settings.SESSION_FILES_MAX} archivos en esta sesión.",
        )

    data = upload.file.read()
    max_bytes = settings.SESSION_FILE_MAX_MB * 1024 * 1024
    if len(data) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo está vacío.")
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El archivo supera el límite de {settings.SESSION_FILE_MAX_MB} MB.",
        )

    _configure_cloudinary()
    resource_type = _resource_type(upload.content_type)

    # Carpetas únicas por archivo: evita colisiones de nombre sin renombrar el
    # archivo. Con `use_filename=True` y `unique_filename=False` Cloudinary
    # conserva el nombre original en la URL, así al descargar coincide.
    unique_folder = f"{settings.CLOUDINARY_FOLDER}/{uuid.uuid4().hex}"
    original_name = upload.filename or "archivo"
    buffer = io.BytesIO(data)
    buffer.name = original_name
    try:
        result = cloudinary.uploader.upload(
            buffer,
            folder=unique_folder,
            resource_type=resource_type,
            filename=original_name,
            use_filename=True,
            unique_filename=False,
            use_filename_as_display_name=True,
            overwrite=False,
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
        logger.error(f"Cloudinary upload failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No se pudo subir el archivo. Intenta de nuevo.",
        ) from exc

    record = VideoSessionFile(
        video_session_id=video_session.id,
        appointment_id=video_session.appointment_id,
        consultation_id=video_session.consultation_id,
        uploader_id=uploader.id,
        uploader_role=uploader_role,
        original_name=upload.filename or "archivo",
        content_type=upload.content_type,
        resource_type=result.get("resource_type", resource_type),
        file_format=result.get("format"),
        bytes=result.get("bytes", len(data)),
        url=result.get("url", ""),
        secure_url=result.get("secure_url", ""),
        public_id=result.get("public_id", ""),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    logger.info(f"Session file uploaded: session={video_session.id} uploader={uploader.id}")
    return record


def delete_session_file(
    db: Session, video_session: VideoSession, uploader: User, file_id: int
) -> None:
    """Borra un archivo de la sesión (solo el propio subidor)."""
    record = (
        db.query(VideoSessionFile)
        .filter(
            VideoSessionFile.id == file_id,
            VideoSessionFile.video_session_id == video_session.id,
        )
        .first()
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado.")
    if record.uploader_id != uploader.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes borrar los archivos que subiste tú.",
        )

    # Borrado best-effort en Cloudinary; aunque falle, quitamos el registro local.
    if settings.cloudinary_enabled and record.public_id:
        try:
            _configure_cloudinary()
            cloudinary.uploader.destroy(
                record.public_id,
                resource_type=record.resource_type,
                invalidate=True,
            )
        except Exception as exc:  # pragma: no cover - depende del proveedor externo
            logger.warning(f"No se pudo borrar el archivo en Cloudinary ({record.public_id}): {exc}")

    db.delete(record)
    db.commit()
    logger.info(f"Session file deleted: session={video_session.id} file={file_id}")
