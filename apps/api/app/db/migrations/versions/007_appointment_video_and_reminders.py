"""Appointment video sessions and reminder state

Revision ID: 007
Revises: 006
Create Date: 2026-04-05 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("video_sessions", "consultation_id", existing_type=sa.Integer(), nullable=True)
    op.add_column("video_sessions", sa.Column("appointment_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_video_sessions_appointment_id"), "video_sessions", ["appointment_id"], unique=False)
    op.create_foreign_key(
        "fk_video_sessions_appointment_id",
        "video_sessions",
        "appointments",
        ["appointment_id"],
        ["id"],
    )

    op.add_column("appointments", sa.Column("day_reminder_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("appointments", sa.Column("hour_reminder_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("appointments", sa.Column("review_reminder_sent_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("appointments", "review_reminder_sent_at")
    op.drop_column("appointments", "hour_reminder_sent_at")
    op.drop_column("appointments", "day_reminder_sent_at")

    op.drop_constraint("fk_video_sessions_appointment_id", "video_sessions", type_="foreignkey")
    op.drop_index(op.f("ix_video_sessions_appointment_id"), table_name="video_sessions")
    op.drop_column("video_sessions", "appointment_id")
    op.alter_column("video_sessions", "consultation_id", existing_type=sa.Integer(), nullable=False)
