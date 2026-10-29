"""Retira las tablas y columnas del sistema de cobro anterior

Revision ID: 047
Revises: 046
Create Date: 2026-10-22 00:00:00.000000

El único flujo de pagos es el de la pasarela actual. Esta migración elimina
las tablas del sistema anterior. A partir de esta revisión solo existe el flujo
de cobro con pasarela.
"""
from alembic import op


revision = "047"
down_revision = "046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS appointment_payments CASCADE")
    op.execute("DROP TABLE IF EXISTS withdrawals CASCADE")
    op.execute("DROP TABLE IF EXISTS wallet_transactions CASCADE")
    op.execute("DROP TABLE IF EXISTS wallets CASCADE")
    op.execute("DROP TYPE IF EXISTS appointmentpaymentstatus")
    op.execute("DROP TYPE IF EXISTS withdrawalstatus")
    op.execute("DROP TYPE IF EXISTS wallettransactiontype")
    op.execute("DROP TYPE IF EXISTS wallettransactionstatus")

    op.execute("ALTER TABLE appointments DROP COLUMN IF EXISTS payment_flow")
    op.execute("ALTER TABLE appointments DROP COLUMN IF EXISTS overtime_terms_accepted_at")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'video_sessions'
                  AND column_name = 'prepaid_amount_cents'
            ) THEN
                ALTER TABLE video_sessions RENAME COLUMN prepaid_amount_cents TO payment_amount_cents;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # La eliminación del sistema de cobro anterior es irreversible.
    pass
