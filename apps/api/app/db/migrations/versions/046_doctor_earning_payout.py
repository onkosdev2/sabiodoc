"""Relación entre ingresos y payouts

Revision ID: 046
Revises: 045
Create Date: 2026-10-21 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "046"
down_revision = "045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "doctor_earnings",
        sa.Column("payout_id", sa.Integer(), sa.ForeignKey("payouts.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_doctor_earnings_payout_id", "doctor_earnings", ["payout_id"])


def downgrade() -> None:
    op.drop_index("ix_doctor_earnings_payout_id", table_name="doctor_earnings")
    op.drop_column("doctor_earnings", "payout_id")
