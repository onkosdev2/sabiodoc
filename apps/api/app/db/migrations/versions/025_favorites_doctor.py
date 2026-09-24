"""Favoritos por médico (antes eran por especialidad)

Revision ID: 025
Revises: 024
Create Date: 2026-10-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Los favoritos de especialidad no se pueden mapear a un médico concreto,
    # así que se eliminan.
    op.drop_constraint("uq_user_specialty_favorite", "favorites", type_="unique")
    op.drop_column("favorites", "specialty_id")

    op.add_column("favorites", sa.Column("doctor_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_favorites_doctor_id", "favorites", "doctor_profiles", ["doctor_id"], ["id"]
    )
    op.execute("DELETE FROM favorites")
    op.alter_column("favorites", "doctor_id", nullable=False)
    op.create_unique_constraint("uq_user_doctor_favorite", "favorites", ["user_id", "doctor_id"])
    op.create_index("ix_favorites_doctor_id", "favorites", ["doctor_id"])
    op.create_index("ix_favorites_user_id", "favorites", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_favorites_user_id", table_name="favorites")
    op.drop_index("ix_favorites_doctor_id", table_name="favorites")
    op.drop_constraint("uq_user_doctor_favorite", "favorites", type_="unique")
    op.drop_constraint("fk_favorites_doctor_id", "favorites", type_="foreignkey")
    op.drop_column("favorites", "doctor_id")

    op.add_column("favorites", sa.Column("specialty_id", sa.Integer(), nullable=True))
    op.create_foreign_key(None, "favorites", "specialties", ["specialty_id"], ["id"])
    op.create_unique_constraint(
        "uq_user_specialty_favorite", "favorites", ["user_id", "specialty_id"]
    )
