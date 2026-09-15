"""Add reviewer role for doctor application review

Revision ID: 011
Revises: 010
Create Date: 2026-05-05 00:00:00.000000

"""
from alembic import op


revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL 12+ permite agregar valores a un enum dentro de una transaccion.
    # El valor solo puede utilizarse despues del commit de esta migracion.
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'reviewer'")


def downgrade() -> None:
    # PostgreSQL no soporta eliminar valores de un tipo enum de forma sencilla.
    # Se deja como no-op para evitar destruir datos existentes.
    pass
