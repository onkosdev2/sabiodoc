"""Confirmación del paciente para ampliaciones de tiempo

Revision ID: 049
Revises: 048
Create Date: 2026-10-26 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "049"
down_revision = "048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE videosessionstatus ADD VALUE IF NOT EXISTS 'extension_requested'")
    op.add_column(
        "video_sessions",
        sa.Column("extension_requested_minutes", sa.Integer(), nullable=True),
    )
    op.add_column(
        "video_sessions",
        sa.Column("extension_requested_amount_cents", sa.Integer(), nullable=True),
    )
    op.add_column(
        "video_sessions",
        sa.Column("extension_requested_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "video_sessions",
        sa.Column("extension_request_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("video_sessions", "extension_request_expires_at")
    op.drop_column("video_sessions", "extension_requested_at")
    op.drop_column("video_sessions", "extension_requested_amount_cents")
    op.drop_column("video_sessions", "extension_requested_minutes")
    # PostgreSQL no elimina valores de enum de forma sencilla.
