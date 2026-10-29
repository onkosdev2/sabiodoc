"""Pagos: clientes, métodos, transacciones, cargos, ingresos y payouts

Revision ID: 043
Revises: 042
Create Date: 2026-10-21 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "043"
down_revision = "042"
branch_labels = None
depends_on = None


payment_method_status = sa.Enum("active", "expired", "removed", name="paymentmethodstatus")
payment_transaction_type = sa.Enum("initial", "extension", "refund", "payout", name="paymenttransactiontype")
payment_transaction_status = sa.Enum(
    "requires_action",
    "processing",
    "succeeded",
    "failed",
    "refunded",
    "partially_refunded",
    "disputed",
    "cancelled",
    name="paymenttransactionstatus",
)
consultation_charge_status = sa.Enum(
    "pending",
    "paid",
    "failed",
    "refunded",
    "partially_refunded",
    name="consultationchargestatus",
)
doctor_earning_status = sa.Enum("pending", "available", "paid", "reversed", name="doctorearningstatus")
payout_status = sa.Enum("pending", "processing", "paid", "failed", name="payoutstatus")


def upgrade() -> None:
    op.create_table(
        "payment_customers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("provider_customer_id", sa.String(length=255), nullable=False),
        sa.Column("default_provider_method_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_payment_customers_id", "payment_customers", ["id"])
    op.create_index("ix_payment_customers_provider_customer_id", "payment_customers", ["provider_customer_id"], unique=True)

    op.create_table(
        "payment_methods",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("provider_method_id", sa.String(length=255), nullable=False),
        sa.Column("brand", sa.String(length=40), nullable=True),
        sa.Column("last4", sa.String(length=4), nullable=True),
        sa.Column("exp_month", sa.Integer(), nullable=True),
        sa.Column("exp_year", sa.Integer(), nullable=True),
        sa.Column("is_default", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("status", payment_method_status, server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("provider", "provider_method_id", name="uq_payment_methods_provider_method"),
    )
    op.create_index("ix_payment_methods_id", "payment_methods", ["id"])
    op.create_index("ix_payment_methods_user_id", "payment_methods", ["user_id"])
    op.create_index("ix_payment_methods_provider_method_id", "payment_methods", ["provider_method_id"])

    op.create_table(
        "payment_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("appointment_id", sa.Integer(), sa.ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("video_session_id", sa.Integer(), sa.ForeignKey("video_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("type", payment_transaction_type, nullable=False),
        sa.Column("status", payment_transaction_status, nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="USD", nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("provider_reference", sa.String(length=255), nullable=True),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False, unique=True),
        sa.Column("failure_code", sa.String(length=80), nullable=True),
        sa.Column("failure_message", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_payment_transactions_id", "payment_transactions", ["id"])
    op.create_index("ix_payment_transactions_user_id", "payment_transactions", ["user_id"])
    op.create_index("ix_payment_transactions_appointment_id", "payment_transactions", ["appointment_id"])
    op.create_index("ix_payment_transactions_video_session_id", "payment_transactions", ["video_session_id"])
    op.create_index("ix_payment_transactions_provider_reference", "payment_transactions", ["provider_reference"])

    op.create_table(
        "consultation_charges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("appointment_id", sa.Integer(), sa.ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doctor_id", sa.Integer(), sa.ForeignKey("doctor_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quoted_minutes", sa.Integer(), nullable=False),
        sa.Column("quoted_amount_cents", sa.Integer(), nullable=False),
        sa.Column("paid_minutes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("paid_amount_cents", sa.Integer(), server_default="0", nullable=False),
        sa.Column("platform_fee_cents", sa.Integer(), server_default="0", nullable=False),
        sa.Column("doctor_net_cents", sa.Integer(), server_default="0", nullable=False),
        sa.Column("payment_method_id", sa.Integer(), sa.ForeignKey("payment_methods.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", consultation_charge_status, server_default="pending", nullable=False),
        sa.Column("initial_transaction_id", sa.Integer(), sa.ForeignKey("payment_transactions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_extension_transaction_id", sa.Integer(), sa.ForeignKey("payment_transactions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_consultation_charges_id", "consultation_charges", ["id"])
    op.create_index("ix_consultation_charges_patient_id", "consultation_charges", ["patient_id"])
    op.create_index("ix_consultation_charges_doctor_id", "consultation_charges", ["doctor_id"])

    op.create_table(
        "doctor_earnings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("doctor_id", sa.Integer(), sa.ForeignKey("doctor_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("appointment_id", sa.Integer(), sa.ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("gross_cents", sa.Integer(), server_default="0", nullable=False),
        sa.Column("platform_fee_cents", sa.Integer(), server_default="0", nullable=False),
        sa.Column("net_cents", sa.Integer(), server_default="0", nullable=False),
        sa.Column("status", doctor_earning_status, server_default="pending", nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_doctor_earnings_id", "doctor_earnings", ["id"])
    op.create_index("ix_doctor_earnings_doctor_id", "doctor_earnings", ["doctor_id"])

    op.create_table(
        "payouts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("doctor_id", sa.Integer(), sa.ForeignKey("doctor_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="USD", nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("provider_reference", sa.String(length=255), nullable=True),
        sa.Column("status", payout_status, server_default="pending", nullable=False),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_payouts_id", "payouts", ["id"])
    op.create_index("ix_payouts_doctor_id", "payouts", ["doctor_id"])
    op.create_index("ix_payouts_provider_reference", "payouts", ["provider_reference"])


def downgrade() -> None:
    op.drop_table("payouts")
    op.drop_table("doctor_earnings")
    op.drop_table("consultation_charges")
    op.drop_table("payment_transactions")
    op.drop_table("payment_methods")
    op.drop_table("payment_customers")
    for enum in (
        payout_status,
        doctor_earning_status,
        consultation_charge_status,
        payment_transaction_status,
        payment_transaction_type,
        payment_method_status,
    ):
        enum.drop(op.get_bind(), checkfirst=True)
