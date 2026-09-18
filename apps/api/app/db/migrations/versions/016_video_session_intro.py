"""Video session AI intro script

Revision ID: 016
Revises: 015
Create Date: 2026-05-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("video_sessions", sa.Column("intro_script", sa.Text(), nullable=True))
    op.add_column(
        "video_sessions",
        sa.Column("intro_generated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("video_sessions", "intro_generated_at")
    op.drop_column("video_sessions", "intro_script")
