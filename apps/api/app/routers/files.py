from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.services import session_file_service

router = APIRouter(prefix="/files", tags=["files"])


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Borra un archivo propio desde cualquier contexto (consulta, cita o historial)."""
    session_file_service.delete_file(db, uploader=current_user, file_id=file_id)
