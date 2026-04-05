"""Schedule, appointments, notifications and audit foundation

Revision ID: 006
Revises: 005
Create Date: 2026-04-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("doctor_profiles", sa.Column("timezone", sa.String(length=120), nullable=True, server_default="UTC"))

    op.create_table(
        "doctor_availability_slots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctor_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_doctor_availability_slots_id"), "doctor_availability_slots", ["id"], unique=False)
    op.create_index(op.f("ix_doctor_availability_slots_doctor_id"), "doctor_availability_slots", ["doctor_id"], unique=False)

    appointment_status = postgresql.ENUM("scheduled", "completed", "cancelled", "no_show", name="appointmentstatus", create_type=False)
    appointment_status.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "appointments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("consultation_id", sa.Integer(), nullable=True),
        sa.Column("specialty_id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("status", appointment_status, nullable=False, server_default="scheduled"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("patient_note", sa.Text(), nullable=True),
        sa.Column("ai_summary_snapshot", sa.Text(), nullable=True),
        sa.Column("doctor_note", sa.Text(), nullable=True),
        sa.Column("followup_instructions", sa.Text(), nullable=True),
        sa.Column("booked_via_ai", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("consent_accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["consultation_id"], ["consultations.id"]),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctor_profiles.id"]),
        sa.ForeignKeyConstraint(["patient_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["specialty_id"], ["specialties.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_appointments_id"), "appointments", ["id"], unique=False)
    op.create_index(op.f("ix_appointments_consultation_id"), "appointments", ["consultation_id"], unique=False)
    op.create_index(op.f("ix_appointments_doctor_id"), "appointments", ["doctor_id"], unique=False)
    op.create_index(op.f("ix_appointments_patient_id"), "appointments", ["patient_id"], unique=False)
    op.create_index(op.f("ix_appointments_scheduled_at"), "appointments", ["scheduled_at"], unique=False)

    op.create_table(
        "consultation_reviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("appointment_id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"]),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctor_profiles.id"]),
        sa.ForeignKeyConstraint(["patient_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("appointment_id"),
    )
    op.create_index(op.f("ix_consultation_reviews_id"), "consultation_reviews", ["id"], unique=False)
    op.create_index(op.f("ix_consultation_reviews_appointment_id"), "consultation_reviews", ["appointment_id"], unique=False)

    notification_status = postgresql.ENUM("unread", "read", name="notificationstatus", create_type=False)
    notification_status.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=120), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("action_url", sa.String(length=500), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("status", notification_status, nullable=False, server_default="unread"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_id"), "notifications", ["id"], unique=False)
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("entity_type", sa.String(length=120), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_id"), "audit_logs", ["id"], unique=False)
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_logs_action"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_id"), table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_id"), table_name="notifications")
    op.drop_table("notifications")
    op.execute("DROP TYPE IF EXISTS notificationstatus")

    op.drop_index(op.f("ix_consultation_reviews_appointment_id"), table_name="consultation_reviews")
    op.drop_index(op.f("ix_consultation_reviews_id"), table_name="consultation_reviews")
    op.drop_table("consultation_reviews")

    op.drop_index(op.f("ix_appointments_scheduled_at"), table_name="appointments")
    op.drop_index(op.f("ix_appointments_patient_id"), table_name="appointments")
    op.drop_index(op.f("ix_appointments_doctor_id"), table_name="appointments")
    op.drop_index(op.f("ix_appointments_consultation_id"), table_name="appointments")
    op.drop_index(op.f("ix_appointments_id"), table_name="appointments")
    op.drop_table("appointments")
    op.execute("DROP TYPE IF EXISTS appointmentstatus")

    op.drop_index(op.f("ix_doctor_availability_slots_doctor_id"), table_name="doctor_availability_slots")
    op.drop_index(op.f("ix_doctor_availability_slots_id"), table_name="doctor_availability_slots")
    op.drop_table("doctor_availability_slots")

    op.drop_column("doctor_profiles", "timezone")
