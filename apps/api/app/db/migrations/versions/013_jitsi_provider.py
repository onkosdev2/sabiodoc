"""Replace Daily video provider with self-hosted Jitsi

Revision ID: 013
Revises: 012
Create Date: 2026-05-15 00:00:00.000000

"""
from alembic import op


revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE videoprovider RENAME TO videoprovider_old")
    op.execute("CREATE TYPE videoprovider AS ENUM ('jitsi', 'jitsi_mock')")
    op.execute(
        "ALTER TABLE video_sessions ALTER COLUMN provider TYPE videoprovider "
        "USING (CASE provider::text "
        "WHEN 'mock_daily' THEN 'jitsi_mock' "
        "ELSE 'jitsi' END)::videoprovider"
    )
    op.execute("DROP TYPE videoprovider_old")


def downgrade() -> None:
    op.execute("ALTER TYPE videoprovider RENAME TO videoprovider_new")
    op.execute("CREATE TYPE videoprovider AS ENUM ('daily', 'mock_daily')")
    op.execute(
        "ALTER TABLE video_sessions ALTER COLUMN provider TYPE videoprovider "
        "USING (CASE provider::text "
        "WHEN 'jitsi_mock' THEN 'mock_daily' "
        "ELSE 'daily' END)::videoprovider"
    )
    op.execute("DROP TYPE videoprovider_new")
