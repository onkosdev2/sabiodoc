import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from app.db.base import Base


class PaymentMethodStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    removed = "removed"


class PaymentTransactionType(str, enum.Enum):
    initial = "initial"
    extension = "extension"
    refund = "refund"
    payout = "payout"


class PaymentTransactionStatus(str, enum.Enum):
    requires_action = "requires_action"
    processing = "processing"
    succeeded = "succeeded"
    failed = "failed"
    refunded = "refunded"
    partially_refunded = "partially_refunded"
    disputed = "disputed"
    cancelled = "cancelled"


class ConsultationChargeStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"
    partially_refunded = "partially_refunded"
    cancelled = "cancelled"


class DoctorEarningStatus(str, enum.Enum):
    pending = "pending"
    available = "available"
    paid = "paid"
    reversed = "reversed"


class PayoutStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    paid = "paid"
    failed = "failed"


class PaymentCustomer(Base):
    __tablename__ = "payment_customers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    provider = Column(String(40), nullable=False)
    provider_customer_id = Column(String(255), nullable=False, unique=True, index=True)
    default_provider_method_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PaymentMethod(Base):
    __tablename__ = "payment_methods"
    __table_args__ = (
        UniqueConstraint("provider", "provider_method_id", name="uq_payment_methods_provider_method"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(40), nullable=False)
    provider_method_id = Column(String(255), nullable=False, index=True)
    brand = Column(String(40), nullable=True)
    last4 = Column(String(4), nullable=True)
    exp_month = Column(Integer, nullable=True)
    exp_year = Column(Integer, nullable=True)
    is_default = Column(Boolean, nullable=False, server_default="false")
    status = Column(Enum(PaymentMethodStatus), nullable=False, server_default=PaymentMethodStatus.active.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True, index=True)
    video_session_id = Column(Integer, ForeignKey("video_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    type = Column(Enum(PaymentTransactionType), nullable=False)
    status = Column(Enum(PaymentTransactionStatus), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(3), nullable=False, server_default="USD")
    provider = Column(String(40), nullable=False)
    provider_reference = Column(String(255), nullable=True, index=True)
    idempotency_key = Column(String(255), nullable=False, unique=True)
    failure_code = Column(String(80), nullable=True)
    failure_message = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ConsultationCharge(Base):
    __tablename__ = "consultation_charges"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, unique=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    quoted_minutes = Column(Integer, nullable=False)
    quoted_amount_cents = Column(Integer, nullable=False)
    paid_minutes = Column(Integer, nullable=False, server_default="0")
    paid_amount_cents = Column(Integer, nullable=False, server_default="0")
    platform_fee_cents = Column(Integer, nullable=False, server_default="0")
    doctor_net_cents = Column(Integer, nullable=False, server_default="0")
    payment_method_id = Column(Integer, ForeignKey("payment_methods.id", ondelete="SET NULL"), nullable=True)
    status = Column(Enum(ConsultationChargeStatus), nullable=False, server_default=ConsultationChargeStatus.pending.value)
    initial_transaction_id = Column(Integer, ForeignKey("payment_transactions.id", ondelete="SET NULL"), nullable=True)
    last_extension_transaction_id = Column(Integer, ForeignKey("payment_transactions.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class DoctorEarning(Base):
    __tablename__ = "doctor_earnings"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, unique=True)
    gross_cents = Column(Integer, nullable=False, server_default="0")
    platform_fee_cents = Column(Integer, nullable=False, server_default="0")
    net_cents = Column(Integer, nullable=False, server_default="0")
    status = Column(Enum(DoctorEarningStatus), nullable=False, server_default=DoctorEarningStatus.pending.value)
    available_at = Column(DateTime(timezone=True), nullable=True)
    payout_id = Column(Integer, ForeignKey("payouts.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Payout(Base):
    __tablename__ = "payouts"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(3), nullable=False, server_default="USD")
    provider = Column(String(40), nullable=False)
    provider_reference = Column(String(255), nullable=True, index=True)
    status = Column(Enum(PayoutStatus), nullable=False, server_default=PayoutStatus.pending.value)
    failure_reason = Column(Text, nullable=True)
    requested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
