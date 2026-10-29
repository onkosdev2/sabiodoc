from app.core.config import settings


class PricingService:
    def validate_price_per_minute(self, price_per_min_cents: int) -> None:
        if price_per_min_cents < settings.VIDEO_PRICE_MIN_CENTS or price_per_min_cents > settings.VIDEO_PRICE_MAX_CENTS:
            raise ValueError(
                f"El precio por minuto debe estar entre {settings.VIDEO_PRICE_MIN_CENTS} y {settings.VIDEO_PRICE_MAX_CENTS} centavos"
            )

pricing_service = PricingService()
