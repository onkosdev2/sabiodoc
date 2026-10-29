"""Clientes y métodos de pago."""

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.payment import PaymentCustomer, PaymentMethod, PaymentMethodStatus
from app.models.user import User
from app.services.payments.factory import get_payment_provider

logger = get_logger(__name__)

MOCK_TOKENS = [
    "pm_mock_success",
    "pm_mock_declined",
    "pm_mock_insufficient",
    "pm_mock_3ds",
    "pm_mock_timeout",
    "pm_mock_expired",
]


class PaymentMethodError(Exception):
    pass


class PaymentMethodService:
    def ensure_enabled(self) -> None:
        # La pasarela de cobros es el único flujo de pagos de la plataforma.
        return None

    def config(self) -> dict:
        provider = get_payment_provider()
        return {
            "provider": provider.name,
            "configured": bool(getattr(provider, "is_configured", True)),
            "currency": settings.PAYMENT_CURRENCY,
            "mock_tokens": MOCK_TOKENS if provider.name == "mock" else None,
        }

    def _get_or_create_customer(self, db: Session, user: User) -> PaymentCustomer:
        customer = db.query(PaymentCustomer).filter(PaymentCustomer.user_id == user.id).first()
        provider = get_payment_provider()
        if customer:
            if customer.provider != provider.name:
                raise PaymentMethodError(
                    f"El cliente está registrado con {customer.provider}; cambia de proveedor requiere migración."
                )
            return customer

        provider_customer_id = provider.create_customer(user_id=user.id, email=user.email)
        customer = PaymentCustomer(
            user_id=user.id,
            provider=provider.name,
            provider_customer_id=provider_customer_id,
        )
        db.add(customer)
        db.flush()
        return customer

    def create_setup_intent(self, db: Session, user: User) -> dict:
        self.ensure_enabled()
        customer = self._get_or_create_customer(db, user)
        try:
            result = get_payment_provider().create_setup_intent(customer_id=customer.provider_customer_id)
        except ValueError as error:
            raise PaymentMethodError(str(error)) from error
        db.commit()
        return result

    def list_methods(self, db: Session, user: User) -> list[PaymentMethod]:
        self.ensure_enabled()
        return (
            db.query(PaymentMethod)
            .filter(
                PaymentMethod.user_id == user.id,
                PaymentMethod.status == PaymentMethodStatus.active,
            )
            .order_by(PaymentMethod.is_default.desc(), PaymentMethod.created_at.desc())
            .all()
        )

    def add_method(
        self,
        db: Session,
        user: User,
        *,
        token: str,
        make_default: bool,
    ) -> PaymentMethod:
        self.ensure_enabled()
        customer = self._get_or_create_customer(db, user)
        provider = get_payment_provider()
        try:
            info = provider.attach_payment_method(
                customer_id=customer.provider_customer_id,
                token=token,
            )
        except ValueError as error:
            raise PaymentMethodError(str(error)) from error

        existing = (
            db.query(PaymentMethod)
            .filter(
                PaymentMethod.user_id == user.id,
                PaymentMethod.status == PaymentMethodStatus.active,
            )
            .count()
        )
        is_default = make_default or existing == 0
        if is_default:
            db.query(PaymentMethod).filter(PaymentMethod.user_id == user.id).update(
                {PaymentMethod.is_default: False}
            )
            provider.set_default_payment_method(
                customer_id=customer.provider_customer_id,
                provider_method_id=info.provider_method_id,
            )
            customer.default_provider_method_id = info.provider_method_id

        method = PaymentMethod(
            user_id=user.id,
            provider=provider.name,
            provider_method_id=info.provider_method_id,
            brand=info.brand,
            last4=info.last4,
            exp_month=info.exp_month,
            exp_year=info.exp_year,
            is_default=is_default,
            status=PaymentMethodStatus.active,
        )
        db.add(method)
        db.commit()
        db.refresh(method)
        logger.info(f"Payment method added: user={user.id}, provider={provider.name}, last4={info.last4}")
        return method

    def set_default(self, db: Session, user: User, method_id: int) -> PaymentMethod:
        self.ensure_enabled()
        method = (
            db.query(PaymentMethod)
            .filter(
                PaymentMethod.id == method_id,
                PaymentMethod.user_id == user.id,
                PaymentMethod.status == PaymentMethodStatus.active,
            )
            .first()
        )
        if not method:
            raise PaymentMethodError("Método de pago no encontrado.")

        customer = self._get_or_create_customer(db, user)
        try:
            get_payment_provider().set_default_payment_method(
                customer_id=customer.provider_customer_id,
                provider_method_id=method.provider_method_id,
            )
        except ValueError as error:
            raise PaymentMethodError(str(error)) from error

        db.query(PaymentMethod).filter(PaymentMethod.user_id == user.id).update(
            {PaymentMethod.is_default: False}
        )
        method.is_default = True
        customer.default_provider_method_id = method.provider_method_id
        db.commit()
        db.refresh(method)
        return method

    def remove(self, db: Session, user: User, method_id: int) -> None:
        self.ensure_enabled()
        method = (
            db.query(PaymentMethod)
            .filter(
                PaymentMethod.id == method_id,
                PaymentMethod.user_id == user.id,
                PaymentMethod.status == PaymentMethodStatus.active,
            )
            .first()
        )
        if not method:
            raise PaymentMethodError("Método de pago no encontrado.")

        customer = self._get_or_create_customer(db, user)
        try:
            get_payment_provider().remove_payment_method(provider_method_id=method.provider_method_id)
        except ValueError as error:
            raise PaymentMethodError(str(error)) from error

        was_default = method.is_default
        method.status = PaymentMethodStatus.removed
        method.is_default = False
        if customer.default_provider_method_id == method.provider_method_id:
            customer.default_provider_method_id = None
        db.flush()

        if was_default:
            replacement = (
                db.query(PaymentMethod)
                .filter(
                    PaymentMethod.user_id == user.id,
                    PaymentMethod.status == PaymentMethodStatus.active,
                )
                .order_by(PaymentMethod.created_at.desc())
                .first()
            )
            if replacement:
                replacement.is_default = True
                customer.default_provider_method_id = replacement.provider_method_id
                try:
                    get_payment_provider().set_default_payment_method(
                        customer_id=customer.provider_customer_id,
                        provider_method_id=replacement.provider_method_id,
                    )
                except ValueError:
                    pass
        db.commit()


payment_method_service = PaymentMethodService()
