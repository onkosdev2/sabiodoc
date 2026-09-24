"""Archivos adjuntos de la cita (pueden subirse tras la videoconsulta)

Revision ID: 026
Revises: 025
Create Date: 2026-10-07 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Permite adjuntar archivos a una cita aunque no haya una sesión de video
    # (p. ej. el médico envía una receta después de la consulta).
    op.alter_column(
        "video_session_files",
        "video_session_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "video_session_files",
        "video_session_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
