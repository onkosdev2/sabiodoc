"""Cascada al borrar usuario o cita en consentimientos

Revision ID: 042
Revises: 041
Create Date: 2026-10-19 00:00:00.000000
"""
from alembic import op


revision = "042"
down_revision = "041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("consents_user_id_fkey", "consents", type_="foreignkey")
    op.create_foreign_key(
        "consents_user_id_fkey",
        "consents",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint("consents_appointment_id_fkey", "consents", type_="foreignkey")
    op.create_foreign_key(
        "consents_appointment_id_fkey",
        "consents",
        "appointments",
        ["appointment_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("consents_appointment_id_fkey", "consents", type_="foreignkey")
    op.create_foreign_key(
        "consents_appointment_id_fkey",
        "consents",
        "appointments",
        ["appointment_id"],
        ["id"],
    )
    op.drop_constraint("consents_user_id_fkey", "consents", type_="foreignkey")
    op.create_foreign_key(
        "consents_user_id_fkey",
        "consents",
        "users",
        ["user_id"],
        ["id"],
    )
