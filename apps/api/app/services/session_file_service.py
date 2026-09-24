"""Archivos compartidos en la videoconsulta y adjuntos de la cita (Cloudinary)."""

import io
import uuid

import cloudinary
import cloudinary.uploader
from cloudinary.exceptions import AuthorizationRequired, NotAllowed
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.appointment import Appointment
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


# --- Consultas ---------------------------------------------------------------


def count_files_for_uploader(db: Session, video_session_id: int, uploader_id: int) -> int:
    return (
        db.query(VideoSessionFile)
        .filter(
            VideoSessionFile.video_session_id == video_session_id,
            VideoSessionFile.uploader_id == uploader_id,
        )
        .count()
    )


def count_files_for_appointment_uploader(
    db: Session, appointment_id: int, uploader_id: int
) -> int:
    return (
        db.query(VideoSessionFile)
        .filter(
            VideoSessionFile.appointment_id == appointment_id,
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


# --- Subida ------------------------------------------------------------------


def _store_file(
    db: Session,
    *,
    uploader: User,
    uploader_role: str,
    upload: UploadFile,
    appointment_id: int | None,
    consultation_id: int | None,
    video_session_id: int | None,
    already_uploaded: int,
) -> VideoSessionFile:
    if not settings.cloudinary_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La carga de archivos no está configurada (Cloudinary).",
        )

    if already_uploaded >= settings.SESSION_FILES_MAX:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya enviaste el máximo de {settings.SESSION_FILES_MAX} archivos.",
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
    # Carpeta única por archivo: conserva el nombre original en la URL sin colisiones.
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
        video_session_id=video_session_id,
        appointment_id=appointment_id,
        consultation_id=consultation_id,
        uploader_id=uploader.id,
        uploader_role=uploader_role,
        original_name=original_name,
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
    logger.info(f"File uploaded: appointment={appointment_id} uploader={uploader.id}")
    return record


def upload_session_file(
    db: Session,
    video_session: VideoSession,
    uploader: User,
    uploader_role: str,
    upload: UploadFile,
) -> VideoSessionFile:
    return _store_file(
        db,
        uploader=uploader,
        uploader_role=uploader_role,
        upload=upload,
        appointment_id=video_session.appointment_id,
        consultation_id=video_session.consultation_id,
        video_session_id=video_session.id,
        already_uploaded=count_files_for_uploader(db, video_session.id, uploader.id),
    )


def upload_appointment_file(
    db: Session,
    appointment: Appointment,
    uploader: User,
    uploader_role: str,
    upload: UploadFile,
) -> VideoSessionFile:
    """Adjunta un archivo a la cita (p. ej. una receta tras la videoconsulta)."""
    latest_session = (
        db.query(VideoSession.id)
        .filter(VideoSession.appointment_id == appointment.id)
        .order_by(VideoSession.id.desc())
        .first()
    )
    return _store_file(
        db,
        uploader=uploader,
        uploader_role=uploader_role,
        upload=upload,
        appointment_id=appointment.id,
        consultation_id=appointment.consultation_id,
        video_session_id=latest_session[0] if latest_session else None,
        already_uploaded=count_files_for_appointment_uploader(db, appointment.id, uploader.id),
    )


# --- Borrado -----------------------------------------------------------------


def _delete_file(
    db: Session,
    *,
    uploader: User,
    file_id: int,
    appointment_id: int | None = None,
    video_session_id: int | None = None,
) -> None:
    query = db.query(VideoSessionFile).filter(VideoSessionFile.id == file_id)
    if appointment_id is not None:
        query = query.filter(VideoSessionFile.appointment_id == appointment_id)
    if video_session_id is not None:
        query = query.filter(VideoSessionFile.video_session_id == video_session_id)

    record = query.first()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado.")
    if record.uploader_id != uploader.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes borrar los archivos que subiste tú.",
        )

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
    logger.info(f"File deleted: file={file_id} uploader={uploader.id}")


def delete_session_file(
    db: Session, video_session: VideoSession, uploader: User, file_id: int
) -> None:
    _delete_file(
        db, uploader=uploader, file_id=file_id, video_session_id=video_session.id
    )


def delete_appointment_file(
    db: Session, appointment: Appointment, uploader: User, file_id: int
) -> None:
    _delete_file(db, uploader=uploader, file_id=file_id, appointment_id=appointment.id)


def delete_file(db: Session, uploader: User, file_id: int) -> None:
    """Borra un archivo propio sin importar la sesión/cita (p. ej. desde el historial)."""
    _delete_file(db, uploader=uploader, file_id=file_id)
