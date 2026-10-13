"""Rol de soporte

Revision ID: 036
Revises: 035
Create Date: 2026-10-12 00:00:00.000000

Agrega el rol ``support`` al enum ``userrole``. Es un rol sumable que permite
ver usuarios y su vista de soporte, sin poder editarlos.
"""
from alembic import op


revision = "036"
down_revision = "035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'support'")


def downgrade() -> None:
    # PostgreSQL no permite eliminar valores de un enum de forma sencilla.
    pass
