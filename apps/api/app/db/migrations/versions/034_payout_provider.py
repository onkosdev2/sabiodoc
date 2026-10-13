"""Retiros automáticos vía pasarela de payouts

Revision ID: 034
Revises: 033
Create Date: 2026-10-12 00:00:00.000000

Elimina la aprobación manual de retiros: ahora se procesan automáticamente a
través de un proveedor de payouts (mock en pruebas, Stripe Connect en
producción). Se añaden los estados ``processing`` y ``failed`` y la referencia
externa del proveedor.
"""
from alembic import op
import sqlalchemy as sa


revision = "034"
down_revision = "033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL 12+ permite añadir valores al enum dentro de una transacción
    # siempre que no se usen en la misma migración.
    op.execute("ALTER TYPE withdrawalstatus ADD VALUE IF NOT EXISTS 'processing'")
    op.execute("ALTER TYPE withdrawalstatus ADD VALUE IF NOT EXISTS 'failed'")
    op.add_column("withdrawals", sa.Column("provider", sa.String(length=40), nullable=True))
    op.add_column("withdrawals", sa.Column("provider_reference", sa.String(length=255), nullable=True))
    op.add_column("withdrawals", sa.Column("failure_reason", sa.Text(), nullable=True))
    op.create_index(
        op.f("ix_withdrawals_provider_reference"),
        "withdrawals",
        ["provider_reference"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_withdrawals_provider_reference"), table_name="withdrawals")
    op.drop_column("withdrawals", "failure_reason")
    op.drop_column("withdrawals", "provider_reference")
    op.drop_column("withdrawals", "provider")
    # No se eliminan los valores del enum (PostgreSQL no lo permite de forma
    # sencilla y podrían existir filas que los usen).
