"""Registro de errores de backend y de navegador para el panel de admin

Revision ID: 033
Revises: 032
Create Date: 2026-10-12 00:00:00.000000

Persiste los errores (excepciones no controladas, HTTP 5xx y fallos de
videoconsulta) y los reportes que envía el navegador. Permite al equipo de IT
ver la causa, el usuario afectado, la sesión de video y el stack trace.
"""
from alembic import op
import sqlalchemy as sa


revision = "033"
down_revision = "032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "error_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False, server_default="error"),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="backend"),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("method", sa.String(length=10), nullable=True),
        sa.Column("path", sa.String(length=500), nullable=True),
        sa.Column("error_type", sa.String(length=200), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("stack_trace", sa.Text(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("user_email", sa.String(length=255), nullable=True),
        sa.Column("user_role", sa.String(length=20), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("video_session_id", sa.Integer(), nullable=True),
        sa.Column("appointment_id", sa.Integer(), nullable=True),
        sa.Column("consultation_id", sa.Integer(), nullable=True),
        sa.Column("context_json", sa.Text(), nullable=True),
        sa.Column("fingerprint", sa.String(length=64), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_error_logs_id"), "error_logs", ["id"], unique=False)
    op.create_index(op.f("ix_error_logs_created_at"), "error_logs", ["created_at"], unique=False)
    op.create_index(op.f("ix_error_logs_level"), "error_logs", ["level"], unique=False)
    op.create_index(op.f("ix_error_logs_source"), "error_logs", ["source"], unique=False)
    op.create_index(op.f("ix_error_logs_user_id"), "error_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_error_logs_request_id"), "error_logs", ["request_id"], unique=False)
    op.create_index(op.f("ix_error_logs_video_session_id"), "error_logs", ["video_session_id"], unique=False)
    op.create_index(op.f("ix_error_logs_appointment_id"), "error_logs", ["appointment_id"], unique=False)
    op.create_index(op.f("ix_error_logs_fingerprint"), "error_logs", ["fingerprint"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_error_logs_fingerprint"), table_name="error_logs")
    op.drop_index(op.f("ix_error_logs_appointment_id"), table_name="error_logs")
    op.drop_index(op.f("ix_error_logs_video_session_id"), table_name="error_logs")
    op.drop_index(op.f("ix_error_logs_request_id"), table_name="error_logs")
    op.drop_index(op.f("ix_error_logs_user_id"), table_name="error_logs")
    op.drop_index(op.f("ix_error_logs_source"), table_name="error_logs")
    op.drop_index(op.f("ix_error_logs_level"), table_name="error_logs")
    op.drop_index(op.f("ix_error_logs_created_at"), table_name="error_logs")
    op.drop_index(op.f("ix_error_logs_id"), table_name="error_logs")
    op.drop_table("error_logs")
