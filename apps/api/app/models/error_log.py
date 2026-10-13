from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base import Base


class ErrorLog(Base):
    """Error capturado en el backend o reportado por el navegador.

    Se guarda una fila por ocurrencia (con ``fingerprint`` para agrupar las
    repetidas) de modo que el equipo de IT pueda ver la línea de tiempo, los
    usuarios afectados y la sesión de video concreta.
    """

    __tablename__ = "error_logs"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(String(20), nullable=False, server_default="error", index=True)
    # "backend" (servidor) o "client" (navegador).
    source = Column(String(20), nullable=False, server_default="backend", index=True)
    status_code = Column(Integer, nullable=True)
    method = Column(String(10), nullable=True)
    path = Column(String(500), nullable=True)
    error_type = Column(String(200), nullable=True)
    message = Column(Text, nullable=False)
    stack_trace = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    # Se desnormalizan para conservar el contexto aunque se elimine el usuario.
    user_email = Column(String(255), nullable=True)
    user_role = Column(String(20), nullable=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)
    request_id = Column(String(64), nullable=True, index=True)
    video_session_id = Column(Integer, nullable=True, index=True)
    appointment_id = Column(Integer, nullable=True, index=True)
    consultation_id = Column(Integer, nullable=True)
    context_json = Column(Text, nullable=True)
    fingerprint = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User", foreign_keys=[user_id])
