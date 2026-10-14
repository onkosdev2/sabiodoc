"""Presencia real en la conferencia de Jitsi

Revision ID: 039
Revises: 038
Create Date: 2026-10-13 00:00:00.000000

Registra si cada participante entró realmente a la sala de Jitsi (eventos del
cliente). El cronómetro y el cobro exigen que ambos estén dentro, en lugar de
derivar la presencia solo de la ruta `/video-room`.
"""
from alembic import op
import sqlalchemy as sa


revision = "039"
down_revision = "038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "video_sessions",
        sa.Column("jitsi_patient_present", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "video_sessions",
        sa.Column("jitsi_doctor_present", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "video_sessions",
        sa.Column("jitsi_patient_joined_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "video_sessions",
        sa.Column("jitsi_doctor_joined_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("video_sessions", "jitsi_doctor_joined_at")
    op.drop_column("video_sessions", "jitsi_patient_joined_at")
    op.drop_column("video_sessions", "jitsi_doctor_present")
    op.drop_column("video_sessions", "jitsi_patient_present")
