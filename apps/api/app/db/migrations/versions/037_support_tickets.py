"""Tickets de soporte (usuario <-> soporte) con adjuntos

Revision ID: 037
Revises: 036
Create Date: 2026-10-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "037"
down_revision = "036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("reference", sa.String(length=20), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column(
            "category",
            sa.Enum(
                "account",
                "payments",
                "video",
                "app_error",
                "other",
                name="supportticketcategory",
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "open",
                "in_progress",
                "waiting_user",
                "resolved",
                "closed",
                name="supportticketstatus",
            ),
            nullable=False,
        ),
        sa.Column(
            "priority",
            sa.Enum(
                "low", "normal", "high", "urgent", name="supportticketpriority"
            ),
            nullable=False,
        ),
        sa.Column("related_appointment_id", sa.Integer(), nullable=True),
        sa.Column("related_video_session_id", sa.Integer(), nullable=True),
        sa.Column("last_error_id", sa.Integer(), nullable=True),
        sa.Column("assigned_to_user_id", sa.Integer(), nullable=True),
        sa.Column("context_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["assigned_to_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["related_appointment_id"], ["appointments.id"]),
        sa.ForeignKeyConstraint(["related_video_session_id"], ["video_sessions.id"]),
        sa.ForeignKeyConstraint(["last_error_id"], ["error_logs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_support_tickets_id"), "support_tickets", ["id"], unique=False)
    op.create_index(op.f("ix_support_tickets_reference"), "support_tickets", ["reference"], unique=True)
    op.create_index(op.f("ix_support_tickets_user_id"), "support_tickets", ["user_id"], unique=False)
    op.create_index(op.f("ix_support_tickets_status"), "support_tickets", ["status"], unique=False)
    op.create_index(op.f("ix_support_tickets_priority"), "support_tickets", ["priority"], unique=False)
    op.create_index(
        op.f("ix_support_tickets_related_appointment_id"),
        "support_tickets",
        ["related_appointment_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_support_tickets_related_video_session_id"),
        "support_tickets",
        ["related_video_session_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_support_tickets_assigned_to_user_id"),
        "support_tickets",
        ["assigned_to_user_id"],
        unique=False,
    )
    op.create_index(op.f("ix_support_tickets_created_at"), "support_tickets", ["created_at"], unique=False)

    op.create_table(
        "support_ticket_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticket_id", sa.Integer(), nullable=False),
        sa.Column("author_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "author_role",
            sa.Enum("user", "support", "system", name="supportticketauthorrole"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["ticket_id"], ["support_tickets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_support_ticket_messages_id"), "support_ticket_messages", ["id"], unique=False)
    op.create_index(
        op.f("ix_support_ticket_messages_ticket_id"),
        "support_ticket_messages",
        ["ticket_id"],
        unique=False,
    )

    op.create_table(
        "support_ticket_attachments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticket_id", sa.Integer(), nullable=True),
        sa.Column("message_id", sa.Integer(), nullable=True),
        sa.Column("uploader_id", sa.Integer(), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=True),
        sa.Column("resource_type", sa.String(length=30), nullable=False),
        sa.Column("file_format", sa.String(length=20), nullable=True),
        sa.Column("bytes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("secure_url", sa.String(length=1000), nullable=False),
        sa.Column("public_id", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["ticket_id"], ["support_tickets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["message_id"], ["support_ticket_messages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploader_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_support_ticket_attachments_id"), "support_ticket_attachments", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_support_ticket_attachments_ticket_id"),
        "support_ticket_attachments",
        ["ticket_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_support_ticket_attachments_message_id"),
        "support_ticket_attachments",
        ["message_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_support_ticket_attachments_uploader_id"),
        "support_ticket_attachments",
        ["uploader_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("support_ticket_attachments")
    op.drop_table("support_ticket_messages")
    op.drop_table("support_tickets")
    op.execute("DROP TYPE IF EXISTS supportticketauthorrole")
    op.execute("DROP TYPE IF EXISTS supportticketpriority")
    op.execute("DROP TYPE IF EXISTS supportticketstatus")
    op.execute("DROP TYPE IF EXISTS supportticketcategory")
