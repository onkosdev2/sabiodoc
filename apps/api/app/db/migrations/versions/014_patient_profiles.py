"""Add patient profiles

Revision ID: 014
Revises: 013
Create Date: 2026-05-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    patient_sex = sa.Enum("male", "female", "other", name="patientsex")

    op.create_table(
        "patient_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("first_name", sa.String(length=120), nullable=True),
        sa.Column("last_name", sa.String(length=120), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("sex", patient_sex, nullable=True),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("country", sa.String(length=120), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("timezone", sa.String(length=120), server_default="UTC", nullable=True),
        sa.Column("blood_type", sa.String(length=10), nullable=True),
        sa.Column("allergies", sa.Text(), nullable=True),
        sa.Column("chronic_conditions", sa.Text(), nullable=True),
        sa.Column("current_medications", sa.Text(), nullable=True),
        sa.Column("family_history", sa.Text(), nullable=True),
        sa.Column("height_cm", sa.Integer(), nullable=True),
        sa.Column("weight_kg", sa.Integer(), nullable=True),
        sa.Column("smoker", sa.Boolean(), nullable=True),
        sa.Column("alcohol", sa.Boolean(), nullable=True),
        sa.Column("emergency_contact_name", sa.String(length=160), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(length=40), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_patient_profiles_id"), "patient_profiles", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_patient_profiles_id"), table_name="patient_profiles")
    op.drop_table("patient_profiles")
    op.execute("DROP TYPE IF EXISTS patientsex")
