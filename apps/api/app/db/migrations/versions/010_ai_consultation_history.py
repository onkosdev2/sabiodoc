"""Unify AI consultation history (triage + guided questionnaire)

Revision ID: 010
Revises: 009
Create Date: 2026-04-20 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "triage_requests",
        sa.Column("source", sa.String(length=20), nullable=False, server_default="triage"),
    )
    op.add_column(
        "triage_requests",
        sa.Column("answers_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.alter_column(
        "triage_requests",
        "symptoms_text",
        existing_type=sa.Text(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "triage_requests",
        "symptoms_text",
        existing_type=sa.Text(),
        nullable=False,
    )
    op.drop_column("triage_requests", "answers_json")
    op.drop_column("triage_requests", "source")
