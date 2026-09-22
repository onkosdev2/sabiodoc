"""Patient profile change requests (médico propone, paciente aprueba)

Revision ID: 020
Revises: 019
Create Date: 2026-10-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    change_status = sa.Enum("pending", "approved", "rejected", name="patientprofilechangestatus")

    op.create_table(
        "patient_profile_change_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("doctor_profile_id", sa.Integer(), nullable=False),
        sa.Column("status", change_status, nullable=False, server_default="pending"),
        sa.Column("proposed_changes", sa.Text(), nullable=False),
        sa.Column("current_snapshot", sa.Text(), nullable=False),
        sa.Column("doctor_message", sa.Text(), nullable=True),
        sa.Column("patient_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["patient_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["doctor_profile_id"], ["doctor_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_patient_profile_change_requests_id"),
        "patient_profile_change_requests",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_patient_profile_change_requests_patient_id"),
        "patient_profile_change_requests",
        ["patient_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_patient_profile_change_requests_doctor_profile_id"),
        "patient_profile_change_requests",
        ["doctor_profile_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_patient_profile_change_requests_doctor_profile_id"),
        table_name="patient_profile_change_requests",
    )
    op.drop_index(
        op.f("ix_patient_profile_change_requests_patient_id"),
        table_name="patient_profile_change_requests",
    )
    op.drop_index(
        op.f("ix_patient_profile_change_requests_id"),
        table_name="patient_profile_change_requests",
    )
    op.drop_table("patient_profile_change_requests")
    op.execute("DROP TYPE IF EXISTS patientprofilechangestatus")
