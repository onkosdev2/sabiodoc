"""Rate limiting en autenticación."""

from fastapi.testclient import TestClient

from app.core.rate_limit import SlidingWindowRateLimiter
from app.main import app

client = TestClient(app)


def test_limiter_permite_hasta_el_maximo_y_luego_bloquea():
    now = {"t": 0.0}
    limiter = SlidingWindowRateLimiter(clock=lambda: now["t"])

    for _ in range(3):
        allowed, _ = limiter.check("clave", max_requests=3, window_seconds=10)
        assert allowed is True

    allowed, retry_after = limiter.check("clave", max_requests=3, window_seconds=10)
    assert allowed is False
    assert retry_after > 0

    # Al pasar la ventana, vuelve a permitir.
    now["t"] = 11.0
    allowed, _ = limiter.check("clave", max_requests=3, window_seconds=10)
    assert allowed is True


def test_login_se_bloquea_tras_varios_intentos_por_cuenta():
    email = "bloqueado@example.com"

    for _ in range(5):
        response = client.post("/auth/login", json={"email": email, "password": "incorrecta"})
        assert response.status_code == 401

    blocked = client.post("/auth/login", json={"email": email, "password": "incorrecta"})
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers


def test_registro_se_bloquea_tras_demasiados_intentos():
    from app.db.session import SessionLocal
    from app.models.user import User

    email = "rl_register@example.com"
    try:
        # La primera petición crea la cuenta y el resto falla por email duplicado,
        # pero todas cuentan para el límite por IP (10/hora).
        for _ in range(10):
            client.post("/auth/register", json={"email": email, "password": "contrasena123"})

        blocked = client.post("/auth/register", json={"email": email, "password": "contrasena123"})
        assert blocked.status_code == 429
    finally:
        db = SessionLocal()
        try:
            db.query(User).filter(User.email == email).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()
