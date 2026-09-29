"""Registro de especialista y foto de perfil del médico

Revision ID: 028
Revises: 027
Create Date: 2026-10-09 00:00:00.000000

Agrega el número del registro nacional de especialistas (equivalente a la
licencia médica, pero para la especialidad) y los datos de la foto de perfil
almacenada en Cloudinary.
"""
from alembic import op
import sqlalchemy as sa


revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "doctor_profiles",
        sa.Column("specialist_registry_number", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "doctor_profiles",
        sa.Column("photo_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "doctor_profiles",
        sa.Column("photo_public_id", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("doctor_profiles", "photo_public_id")
    op.drop_column("doctor_profiles", "photo_url")
    op.drop_column("doctor_profiles", "specialist_registry_number")
