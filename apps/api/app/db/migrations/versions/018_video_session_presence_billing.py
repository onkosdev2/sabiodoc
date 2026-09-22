"""Facturacion por tiempo real y presencia de participantes en la videoconsulta

Revision ID: 018
Revises: 017
Create Date: 2026-09-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "video_sessions",
        sa.Column("patient_present", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "video_sessions",
        sa.Column("doctor_present", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "video_sessions",
        sa.Column("patient_last_seen_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "video_sessions",
        sa.Column("doctor_last_seen_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.add_column(
        "appointment_payments",
        sa.Column("billable_seconds", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "appointment_payments",
        sa.Column("billable_amount_cents", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("appointment_payments", "billable_amount_cents")
    op.drop_column("appointment_payments", "billable_seconds")
    op.drop_column("video_sessions", "doctor_last_seen_at")
    op.drop_column("video_sessions", "patient_last_seen_at")
    op.drop_column("video_sessions", "doctor_present")
    op.drop_column("video_sessions", "patient_present")
