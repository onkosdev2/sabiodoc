from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class VideoSessionFile(Base):
    """Archivo compartido durante una videoconsulta (subido a Cloudinary).

    Se guardan solo los metadatos y las URLs; el binario vive en Cloudinary.
    """

    __tablename__ = "video_session_files"

    id = Column(Integer, primary_key=True, index=True)
    video_session_id = Column(Integer, ForeignKey("video_sessions.id"), nullable=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True, index=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=True, index=True)
    uploader_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # "patient" | "doctor"
    uploader_role = Column(String(20), nullable=False)

    original_name = Column(String(255), nullable=False)
    content_type = Column(String(120), nullable=True)
    # "image" | "video" | "raw"
    resource_type = Column(String(30), nullable=False)
    file_format = Column(String(20), nullable=True)
    bytes = Column(Integer, nullable=False, server_default="0")
    url = Column(String(1000), nullable=False)
    secure_url = Column(String(1000), nullable=False)
    public_id = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    video_session = relationship("VideoSession", backref="files")
    uploader = relationship("User", foreign_keys=[uploader_id])
