"""Tiempo extra facturable y aceptacion de terminos de extension

Revision ID: 019
Revises: 018
Create Date: 2026-09-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "appointment_payments",
        sa.Column("overtime_amount_cents", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "appointments",
        sa.Column("overtime_terms_accepted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("appointments", "overtime_terms_accepted_at")
    op.drop_column("appointment_payments", "overtime_amount_cents")
