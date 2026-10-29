"""Extensiones de tiempo de la videoconsulta

Revision ID: 045
Revises: 044
Create Date: 2026-10-21 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "045"
down_revision = "044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE videosessionstatus ADD VALUE IF NOT EXISTS 'extension_pending'")
    op.add_column(
        "video_sessions",
        sa.Column("extension_deadline", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("video_sessions", "extension_deadline")
