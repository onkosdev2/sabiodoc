"""Índices en claves foráneas de lectura frecuente

Revision ID: 022
Revises: 021
Create Date: 2026-10-03 00:00:00.000000

"""
from alembic import op


revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None

# (nombre, tabla, columnas). Índices para FKs que se filtran mucho y no tenían.
_INDEXES = [
    ("ix_consultations_user_id", "consultations", ["user_id"]),
    ("ix_consultations_specialty_id", "consultations", ["specialty_id"]),
    ("ix_consultation_reviews_doctor_id", "consultation_reviews", ["doctor_id"]),
    ("ix_consultation_reviews_patient_id", "consultation_reviews", ["patient_id"]),
    ("ix_triage_requests_user_id", "triage_requests", ["user_id"]),
    ("ix_video_sessions_consultation_id", "video_sessions", ["consultation_id"]),
    ("ix_video_sessions_patient_id", "video_sessions", ["patient_id"]),
    ("ix_video_sessions_doctor_id", "video_sessions", ["doctor_id"]),
    ("ix_video_session_events_video_session_id", "video_session_events", ["video_session_id"]),
    ("ix_appointments_specialty_id", "appointments", ["specialty_id"]),
    ("ix_appointment_payments_patient_id", "appointment_payments", ["patient_id"]),
    ("ix_appointment_payments_doctor_id", "appointment_payments", ["doctor_id"]),
    ("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"]),
]

# Índice redundante: `appointment_id` ya está cubierto por su constraint único.
_DROP_INDEXES = [
    ("ix_consultation_reviews_appointment_id", "consultation_reviews"),
]


def upgrade() -> None:
    for name, table, columns in _INDEXES:
        op.create_index(name, table, columns, unique=False)
    for name, table in _DROP_INDEXES:
        op.drop_index(name, table_name=table)


def downgrade() -> None:
    for name, table in reversed(_DROP_INDEXES):
        op.create_index(name, table, ["appointment_id"], unique=False)
    for name, table, _columns in reversed(_INDEXES):
        op.drop_index(name, table_name=table)
