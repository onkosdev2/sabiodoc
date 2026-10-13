"""Quita el estado de resolución de los errores

Revision ID: 038
Revises: 037
Create Date: 2026-10-12 00:00:00.000000

La resolución de errores se gestiona manualmente, así que no se registra estado
en la base de datos.
"""
from alembic import op
import sqlalchemy as sa


revision = "038"
down_revision = "037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Al eliminar la columna, PostgreSQL elimina automáticamente su FK.
    op.drop_column("error_logs", "resolved_by_id")
    op.drop_column("error_logs", "resolved_at")


def downgrade() -> None:
    op.add_column("error_logs", sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("error_logs", sa.Column("resolved_by_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "error_logs_resolved_by_id_fkey",
        "error_logs",
        "users",
        ["resolved_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
