"""Add doctor approval status

Revision ID: 004
Revises: 003
Create Date: 2026-04-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    approval_status = sa.Enum("pending", "approved", "rejected", "suspended", name="doctorapprovalstatus")
    approval_status.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "doctor_profiles",
        sa.Column("status", approval_status, server_default="pending", nullable=False),
    )
    op.execute("UPDATE doctor_profiles SET status = 'approved'")


def downgrade() -> None:
    op.drop_column("doctor_profiles", "status")
    op.execute("DROP TYPE IF EXISTS doctorapprovalstatus")
