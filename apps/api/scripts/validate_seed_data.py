"""Falla si hay médicos de prueba publicados en producción.

Uso (desde apps/api):
    ./venv/bin/python scripts/validate_seed_data.py

Pensado para ejecutarse manualmente antes de pasar a producción real o como
paso opcional del pipeline. No se incluye en el pre-deploy para no bloquear
entornos de testeo que todavía conservan perfiles demo.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal  # noqa: E402
from app.services.seed_guard import find_published_seed_doctors  # noqa: E402


def main() -> int:
    db = SessionLocal()
    try:
        suspects = find_published_seed_doctors(db)
        if not suspects:
            print("✅ No hay médicos de prueba publicados.")
            return 0

        print(f"❌ Hay {len(suspects)} médico(s) de prueba publicados:")
        for profile in suspects:
            email = profile.user.email if profile.user else "(sin correo)"
            print(f"  - id={profile.id} nombre={profile.display_name!r} correo={email}")
        print("Despublícalos o marca is_published=false antes de producción real.")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
