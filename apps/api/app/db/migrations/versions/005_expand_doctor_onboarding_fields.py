"""Expand doctor onboarding fields

Revision ID: 005
Revises: 004
Create Date: 2026-04-04 00:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("doctor_profiles", sa.Column("professional_title", sa.String(length=255), nullable=True))
    op.add_column("doctor_profiles", sa.Column("license_number", sa.String(length=120), nullable=True))
    op.add_column("doctor_profiles", sa.Column("license_country", sa.String(length=120), nullable=True))
    op.add_column("doctor_profiles", sa.Column("country", sa.String(length=120), nullable=True))
    op.add_column("doctor_profiles", sa.Column("city", sa.String(length=120), nullable=True))
    op.add_column("doctor_profiles", sa.Column("government_id", sa.String(length=120), nullable=True))
    op.add_column("doctor_profiles", sa.Column("years_experience", sa.Integer(), nullable=True))
    op.add_column("doctor_profiles", sa.Column("review_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("doctor_profiles", "review_notes")
    op.drop_column("doctor_profiles", "years_experience")
    op.drop_column("doctor_profiles", "government_id")
    op.drop_column("doctor_profiles", "city")
    op.drop_column("doctor_profiles", "country")
    op.drop_column("doctor_profiles", "license_country")
    op.drop_column("doctor_profiles", "license_number")
    op.drop_column("doctor_profiles", "professional_title")
