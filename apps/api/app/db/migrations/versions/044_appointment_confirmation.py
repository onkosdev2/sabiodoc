"""Confirmación manual de citas y flujo de pago

Revision ID: 044
Revises: 043
Create Date: 2026-10-21 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "044"
down_revision = "043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE consultationchargestatus ADD VALUE IF NOT EXISTS 'cancelled'")
    op.add_column(
        "appointments",
        sa.Column("confirmation_status", sa.String(length=30), nullable=False, server_default="not_required"),
    )
    op.add_column(
        "appointments",
        sa.Column("confirmation_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "appointments",
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "appointments",
        sa.Column("confirmed_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "appointments",
        sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "appointments",
        sa.Column("decline_reason", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("appointments", "decline_reason")
    op.drop_column("appointments", "declined_at")
    op.drop_column("appointments", "confirmed_by_user_id")
    op.drop_column("appointments", "confirmed_at")
    op.drop_column("appointments", "confirmation_expires_at")
    op.drop_column("appointments", "confirmation_status")
