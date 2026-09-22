import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import backref, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class WalletTransactionType(str, enum.Enum):
    """Tipos de movimiento del monedero de créditos.

    1 crédito = 1 USD = 100 centavos. Se guardan los montos en centavos.
    """

    topup = "topup"  # recarga de créditos (dinero de pruebas)
    withdrawal = "withdrawal"  # retiro de créditos a una cuenta
    consultation_payment = "consultation_payment"  # paciente paga una cita
    consultation_income = "consultation_income"  # médico recibe el pago de una cita
    refund = "refund"  # devolución al paciente
    adjustment = "adjustment"  # ajuste manual del administrador


class WalletTransactionStatus(str, enum.Enum):
    completed = "completed"
    pending = "pending"
    reversed = "reversed"


class WithdrawalStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    rejected = "rejected"


class AppointmentPaymentStatus(str, enum.Enum):
    held = "held"
    released = "released"
    refunded = "refunded"


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    # Saldo en centavos: 1 crédito = 100 centavos.
    balance_cents = Column(Integer, nullable=False, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="wallet")


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(Enum(WalletTransactionType), nullable=False)
    status = Column(Enum(WalletTransactionStatus), nullable=False, default=WalletTransactionStatus.completed)
    # Monto con signo: positivo = entra dinero, negativo = sale.
    amount_cents = Column(Integer, nullable=False)
    balance_after_cents = Column(Integer, nullable=False)
    description = Column(String(255), nullable=False)
    reference_type = Column(String(40), nullable=True)
    reference_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    wallet = relationship("Wallet", backref="transactions")


class Withdrawal(Base):
    __tablename__ = "withdrawals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount_cents = Column(Integer, nullable=False)
    status = Column(Enum(WithdrawalStatus), nullable=False, default=WithdrawalStatus.pending, index=True)
    # Cuenta de destino (dinero falso por ahora: se guarda como texto de referencia).
    destination = Column(String(255), nullable=False)
    admin_notes = Column(Text, nullable=True)
    processed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
    processed_by = relationship("User", foreign_keys=[processed_by_user_id])


class AppointmentPayment(Base):
    """Dinero retenido por una cita: se libera al médico o se reembolsa al paciente."""

    __tablename__ = "appointment_payments"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, unique=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    amount_cents = Column(Integer, nullable=False)
    # Lo que efectivamente recibe el médico (monto menos comisión de plataforma).
    doctor_amount_cents = Column(Integer, nullable=False)
    platform_fee_cents = Column(Integer, nullable=False, server_default="0")
    # Tiempo real facturado y monto real cobrado (<= amount_cents, que es el maximo retenido).
    billable_seconds = Column(Integer, nullable=False, server_default="0")
    billable_amount_cents = Column(Integer, nullable=True)
    # Tiempo extra ya consumido del monedero del paciente (fuera de la retencion).
    overtime_amount_cents = Column(Integer, nullable=False, server_default="0")
    status = Column(Enum(AppointmentPaymentStatus), nullable=False, default=AppointmentPaymentStatus.held)
    released_at = Column(DateTime(timezone=True), nullable=True)
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    appointment = relationship("Appointment", backref=backref("payment", uselist=False))
    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("DoctorProfile", foreign_keys=[doctor_id])
