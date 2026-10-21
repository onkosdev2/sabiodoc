"""Consentimientos versionados

Revision ID: 041
Revises: 040
Create Date: 2026-10-19 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "041"
down_revision = "040"
branch_labels = None
depends_on = None


consent_type = postgresql.ENUM(
    "terms",
    "privacy",
    "clinical_data",
    "telemedicine",
    "transcription",
    "recording",
    "marketing",
    name="consenttype",
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE consenttype AS ENUM "
        "('terms','privacy','clinical_data','telemedicine','transcription','recording','marketing'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    )
    op.create_table(
        "consents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("appointment_id", sa.Integer(), sa.ForeignKey("appointments.id", ondelete="CASCADE"), nullable=True),
        sa.Column("consent_type", consent_type, nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
    )
    op.create_index("ix_consents_id", "consents", ["id"])
    op.create_index("ix_consents_user_id", "consents", ["user_id"])
    op.create_index("ix_consents_user_type", "consents", ["user_id", "consent_type"])
    op.create_index("ix_consents_appointment", "consents", ["appointment_id"])


def downgrade() -> None:
    op.drop_index("ix_consents_appointment", table_name="consents")
    op.drop_index("ix_consents_user_type", table_name="consents")
    op.drop_index("ix_consents_user_id", table_name="consents")
    op.drop_index("ix_consents_id", table_name="consents")
    op.drop_table("consents")
    consent_type.drop(op.get_bind(), checkfirst=True)
