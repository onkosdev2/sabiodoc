"""Configuración de tests.

Aísla los tests en una **base de datos dedicada** (por defecto, el nombre de la
BD de desarrollo con sufijo `_test`). Antes de ejecutar cualquier test:
1. se fija `DATABASE_URL` a la BD de test (antes de importar `app`),
2. se crea la BD si no existe,
3. se aplican las migraciones de Alembic,
4. se vacían las tablas y se siembran los datos demo.

Así los tests no ensucian la BD de desarrollo ni dependen de ejecuciones
anteriores. Para usar otra BD, exporta `TEST_DATABASE_URL`.
"""

import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg2
from psycopg2 import sql as pg_sql


def _test_database_url() -> str:
    explicit = os.environ.get("TEST_DATABASE_URL")
    if explicit:
        return explicit

    base = (
        os.environ.get("DATABASE_URL")
        or "postgresql://sabiodoc:sabiodoc_secret@localhost:55432/sabiodoc_db"
    )
    parts = urlsplit(base)
    name = parts.path.lstrip("/")
    if not name:
        return base
    if not name.endswith("_test"):
        name = f"{name}_test"
    return urlunsplit(parts._replace(path=f"/{name}"))


TEST_DATABASE_URL = _test_database_url()
# Debe fijarse ANTES de importar cualquier módulo de `app` (settings es singleton).
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("ENVIRONMENT", "development")

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402

from app.core.rate_limit import rate_limiter  # noqa: E402


def _ensure_database() -> None:
    parts = urlsplit(TEST_DATABASE_URL)
    db_name = parts.path.lstrip("/")
    admin_url = urlunsplit(parts._replace(path="/postgres"))

    connection = psycopg2.connect(admin_url)
    connection.autocommit = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
            if cursor.fetchone() is None:
                cursor.execute(pg_sql.SQL("CREATE DATABASE {}").format(pg_sql.Identifier(db_name)))
    finally:
        connection.close()


def _run_migrations() -> None:
    api_root = Path(__file__).resolve().parents[2]
    config = Config(str(api_root / "alembic.ini"))
    config.set_main_option("script_location", str(api_root / "app" / "db" / "migrations"))
    command.upgrade(config, "head")


def _reset_and_seed() -> None:
    from sqlalchemy import inspect, text

    from app.db.session import engine
    from app.seed import run_seed

    tables = [name for name in inspect(engine).get_table_names() if name != "alembic_version"]
    if tables:
        with engine.begin() as connection:
            connection.execute(text(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE"))

    run_seed.seed_specialties()
    run_seed.seed_demo_admin()
    run_seed.seed_demo_reviewer()
    run_seed.seed_demo_doctors()
    run_seed.seed_demo_patient()
    run_seed.seed_demo_reviews()


@pytest.fixture(scope="session", autouse=True)
def _prepare_test_database():
    _ensure_database()
    _run_migrations()
    _reset_and_seed()
    yield


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Aísla el rate limiter entre tests (es estado global en memoria)."""
    rate_limiter.reset()
    yield
    rate_limiter.reset()
