"""Dirección del médico

Revision ID: 030
Revises: 029
Create Date: 2026-10-11 00:00:00.000000

Agrega la dirección del consultorio/domicilio profesional del médico, que puede
capturarse al postularse y al editar el perfil.
"""
from alembic import op
import sqlalchemy as sa


revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "doctor_profiles",
        sa.Column("address", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("doctor_profiles", "address")
