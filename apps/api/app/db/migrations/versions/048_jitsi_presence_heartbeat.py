"""Heartbeat de presencia real en Jitsi

Revision ID: 048
Revises: 047
Create Date: 2026-10-26 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "048"
down_revision = "047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "video_sessions",
        sa.Column("jitsi_patient_last_seen_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "video_sessions",
        sa.Column("jitsi_doctor_last_seen_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        """
        UPDATE video_sessions
        SET jitsi_patient_last_seen_at = jitsi_patient_joined_at
        WHERE jitsi_patient_present = true AND jitsi_patient_joined_at IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE video_sessions
        SET jitsi_doctor_last_seen_at = jitsi_doctor_joined_at
        WHERE jitsi_doctor_present = true AND jitsi_doctor_joined_at IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("video_sessions", "jitsi_doctor_last_seen_at")
    op.drop_column("video_sessions", "jitsi_patient_last_seen_at")
