"""Structured AI intake for consultations and appointments

Revision ID: 009
Revises: 008
Create Date: 2026-04-05 03:30:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("consultations", sa.Column("intake_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("appointments", sa.Column("ai_intake_snapshot_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column("appointments", "ai_intake_snapshot_json")
    op.drop_column("consultations", "intake_json")
