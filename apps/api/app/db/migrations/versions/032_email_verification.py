"""Verificación de correo al registrarse

Revision ID: 032
Revises: 031
Create Date: 2026-10-13 00:00:00.000000

Agrega el estado de verificación de correo al usuario y los tokens de un solo
uso para confirmar la cuenta desde el enlace enviado por email.
"""
from alembic import op
import sqlalchemy as sa


revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Las cuentas existentes se consideran verificadas.
    op.add_column(
        "users",
        sa.Column(
            "is_email_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )

    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_email_verification_tokens_id"), "email_verification_tokens", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_email_verification_tokens_user_id"),
        "email_verification_tokens",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_email_verification_tokens_token_hash"),
        "email_verification_tokens",
        ["token_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_email_verification_tokens_token_hash"),
        table_name="email_verification_tokens",
    )
    op.drop_index(
        op.f("ix_email_verification_tokens_user_id"), table_name="email_verification_tokens"
    )
    op.drop_index(op.f("ix_email_verification_tokens_id"), table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")
    op.drop_column("users", "is_email_verified")
