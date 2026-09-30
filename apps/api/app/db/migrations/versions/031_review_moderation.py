"""Moderación de reseñas y reportes de pacientes

Revision ID: 031
Revises: 030
Create Date: 2026-10-12 00:00:00.000000

Permite ocultar reseñas inapropiadas (sin borrar el historial) y que los
pacientes reporten una opinión para su revisión por un administrador.
"""
from alembic import op
import sqlalchemy as sa


revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "consultation_reviews",
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "consultation_reviews",
        sa.Column("hidden_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "consultation_reviews",
        sa.Column("hidden_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "consultation_reviews",
        sa.Column("hidden_by_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_consultation_reviews_hidden_by_id",
        "consultation_reviews",
        "users",
        ["hidden_by_id"],
        ["id"],
    )

    op.create_table(
        "review_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("review_id", sa.Integer(), nullable=False),
        sa.Column("reporter_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "resolved", "dismissed", name="reviewreportstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["review_id"], ["consultation_reviews.id"]),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("review_id", "reporter_id", name="uq_review_report_reporter"),
    )
    op.create_index(op.f("ix_review_reports_id"), "review_reports", ["id"], unique=False)
    op.create_index(op.f("ix_review_reports_review_id"), "review_reports", ["review_id"], unique=False)
    op.create_index(op.f("ix_review_reports_reporter_id"), "review_reports", ["reporter_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_review_reports_reporter_id"), table_name="review_reports")
    op.drop_index(op.f("ix_review_reports_review_id"), table_name="review_reports")
    op.drop_index(op.f("ix_review_reports_id"), table_name="review_reports")
    op.drop_table("review_reports")
    op.execute("DROP TYPE IF EXISTS reviewreportstatus")

    op.drop_constraint(
        "fk_consultation_reviews_hidden_by_id", "consultation_reviews", type_="foreignkey"
    )
    op.drop_column("consultation_reviews", "hidden_by_id")
    op.drop_column("consultation_reviews", "hidden_at")
    op.drop_column("consultation_reviews", "hidden_reason")
    op.drop_column("consultation_reviews", "is_hidden")
