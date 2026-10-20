"""Flags de publicación y datos seed en médicos

Revision ID: 040
Revises: 039
Create Date: 2026-10-19 00:00:00.000000

Permite despublicar un perfil sin borrar su historial y marcar los perfiles
creados por el seed para impedir que se publiquen en producción.
"""
from alembic import op
import sqlalchemy as sa


revision = "040"
down_revision = "039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "doctor_profiles",
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "doctor_profiles",
        sa.Column("is_seed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("doctor_profiles", "is_seed")
    op.drop_column("doctor_profiles", "is_published")
