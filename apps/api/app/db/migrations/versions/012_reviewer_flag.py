"""Add independent reviewer capability flag

Revision ID: 012
Revises: 011
Create Date: 2026-05-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_reviewer", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # Migramos el rol "reviewer" al nuevo flag, conservando el rol base real.
    op.execute("UPDATE users SET is_reviewer = true WHERE role = 'reviewer'")
    op.execute(
        "UPDATE users SET role = 'doctor' "
        "WHERE role = 'reviewer' AND id IN ("
        "SELECT user_id FROM doctor_profiles WHERE status = 'approved')"
    )
    op.execute("UPDATE users SET role = 'patient' WHERE role = 'reviewer'")


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'reviewer' WHERE is_reviewer = true")
    op.drop_column("users", "is_reviewer")
