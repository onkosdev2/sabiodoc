"""Add doctor and video consultation entities

Revision ID: 003
Revises: 002
Create Date: 2026-04-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "doctor_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("bio_short", sa.Text(), nullable=True),
        sa.Column("price_per_min_cents", sa.Integer(), nullable=False),
        sa.Column("rating_avg", sa.Numeric(precision=3, scale=2), server_default="0", nullable=False),
        sa.Column("rating_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_accepting_consultations", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id")
    )
    op.create_index(op.f("ix_doctor_profiles_id"), "doctor_profiles", ["id"], unique=False)

    op.create_table(
        "doctor_specialties",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("specialty_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctor_profiles.id"]),
        sa.ForeignKeyConstraint(["specialty_id"], ["specialties.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("doctor_id", "specialty_id", name="uq_doctor_specialty")
    )
    op.create_index(op.f("ix_doctor_specialties_id"), "doctor_specialties", ["id"], unique=False)

    op.create_table(
        "doctor_presences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.Enum("offline", "online", "busy", name="doctorpresencestatus"), nullable=False),
        sa.Column("status_message", sa.String(length=255), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctor_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("doctor_id")
    )
    op.create_index(op.f("ix_doctor_presences_id"), "doctor_presences", ["id"], unique=False)

    op.create_table(
        "video_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("consultation_id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.Enum("daily", "mock_daily", name="videoprovider"), nullable=False),
        sa.Column("status", sa.Enum("prepared", "active", "completed", "cancelled", "expired", "failed", name="videosessionstatus"), nullable=False),
        sa.Column("payment_status", sa.Enum("pending", "authorized", "captured", "failed", "waived", name="paymentstatus"), nullable=False),
        sa.Column("provider_room_name", sa.String(length=255), nullable=False),
        sa.Column("provider_room_url", sa.String(length=500), nullable=True),
        sa.Column("payment_reference", sa.String(length=255), nullable=True),
        sa.Column("doctor_price_per_min_cents", sa.Integer(), nullable=False),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False),
        sa.Column("prepaid_amount_cents", sa.Integer(), nullable=False),
        sa.Column("billable_seconds", sa.Integer(), server_default="0", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["consultation_id"], ["consultations.id"]),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctor_profiles.id"]),
        sa.ForeignKeyConstraint(["patient_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider_room_name")
    )
    op.create_index(op.f("ix_video_sessions_id"), "video_sessions", ["id"], unique=False)

    op.create_table(
        "video_session_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("video_session_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["video_session_id"], ["video_sessions.id"]),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(op.f("ix_video_session_events_id"), "video_session_events", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_video_session_events_id"), table_name="video_session_events")
    op.drop_table("video_session_events")
    op.drop_index(op.f("ix_video_sessions_id"), table_name="video_sessions")
    op.drop_table("video_sessions")
    op.drop_index(op.f("ix_doctor_presences_id"), table_name="doctor_presences")
    op.drop_table("doctor_presences")
    op.drop_index(op.f("ix_doctor_specialties_id"), table_name="doctor_specialties")
    op.drop_table("doctor_specialties")
    op.drop_index(op.f("ix_doctor_profiles_id"), table_name="doctor_profiles")
    op.drop_table("doctor_profiles")

    op.execute("DROP TYPE IF EXISTS paymentstatus")
    op.execute("DROP TYPE IF EXISTS videosessionstatus")
    op.execute("DROP TYPE IF EXISTS videoprovider")
    op.execute("DROP TYPE IF EXISTS doctorpresencestatus")
