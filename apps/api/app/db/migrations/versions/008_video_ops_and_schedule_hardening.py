"""Video operations and schedule hardening

Revision ID: 008
Revises: 007
Create Date: 2026-04-05 02:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("appointments", sa.Column("joined_patient_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("appointments", sa.Column("joined_doctor_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("appointments", sa.Column("no_show_marked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("appointments", sa.Column("cancellation_reason", sa.Text(), nullable=True))
    op.add_column("appointments", sa.Column("consent_text_version", sa.String(length=50), nullable=True))

    op.add_column("video_sessions", sa.Column("joined_patient_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("video_sessions", sa.Column("joined_doctor_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("video_sessions", sa.Column("doctor_note", sa.Text(), nullable=True))
    op.add_column("video_sessions", sa.Column("followup_instructions", sa.Text(), nullable=True))
    op.add_column("video_sessions", sa.Column("closed_reason", sa.String(length=120), nullable=True))
    op.add_column("video_sessions", sa.Column("ended_by_user_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_video_sessions_ended_by_user_id",
        "video_sessions",
        "users",
        ["ended_by_user_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_video_sessions_ended_by_user_id", "video_sessions", type_="foreignkey")
    op.drop_column("video_sessions", "ended_by_user_id")
    op.drop_column("video_sessions", "closed_reason")
    op.drop_column("video_sessions", "followup_instructions")
    op.drop_column("video_sessions", "doctor_note")
    op.drop_column("video_sessions", "joined_doctor_at")
    op.drop_column("video_sessions", "joined_patient_at")

    op.drop_column("appointments", "consent_text_version")
    op.drop_column("appointments", "cancellation_reason")
    op.drop_column("appointments", "no_show_marked_at")
    op.drop_column("appointments", "joined_doctor_at")
    op.drop_column("appointments", "joined_patient_at")
