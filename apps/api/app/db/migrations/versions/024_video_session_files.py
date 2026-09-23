"""Archivos compartidos en la videoconsulta (Cloudinary)

Revision ID: 024
Revises: 023
Create Date: 2026-10-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "video_session_files",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("video_session_id", sa.Integer(), nullable=False),
        sa.Column("appointment_id", sa.Integer(), nullable=True),
        sa.Column("consultation_id", sa.Integer(), nullable=True),
        sa.Column("uploader_id", sa.Integer(), nullable=False),
        sa.Column("uploader_role", sa.String(length=20), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=True),
        sa.Column("resource_type", sa.String(length=30), nullable=False),
        sa.Column("file_format", sa.String(length=20), nullable=True),
        sa.Column("bytes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("secure_url", sa.String(length=1000), nullable=False),
        sa.Column("public_id", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["video_session_id"], ["video_sessions.id"]),
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"]),
        sa.ForeignKeyConstraint(["consultation_id"], ["consultations.id"]),
        sa.ForeignKeyConstraint(["uploader_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_video_session_files_id"), "video_session_files", ["id"], unique=False)
    op.create_index(
        op.f("ix_video_session_files_video_session_id"),
        "video_session_files",
        ["video_session_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_video_session_files_appointment_id"),
        "video_session_files",
        ["appointment_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_video_session_files_consultation_id"),
        "video_session_files",
        ["consultation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_video_session_files_uploader_id"),
        "video_session_files",
        ["uploader_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_video_session_files_uploader_id"), table_name="video_session_files")
    op.drop_index(op.f("ix_video_session_files_consultation_id"), table_name="video_session_files")
    op.drop_index(op.f("ix_video_session_files_appointment_id"), table_name="video_session_files")
    op.drop_index(op.f("ix_video_session_files_video_session_id"), table_name="video_session_files")
    op.drop_index(op.f("ix_video_session_files_id"), table_name="video_session_files")
    op.drop_table("video_session_files")
