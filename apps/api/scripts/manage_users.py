"""Utilidad para ver usuarios y resetear contraseñas.

Las contraseñas se guardan hasheadas con bcrypt (irreversibles), por lo que no
se pueden "leer". Este script permite listar usuarios y asignar una contraseña
nueva a cualquiera.

Uso (desde apps/api):
    ./venv/bin/python scripts/manage_users.py list
    ./venv/bin/python scripts/manage_users.py list --role doctor
    ./venv/bin/python scripts/manage_users.py set-password usuario@ejemplo.com NuevaPass123!
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.security import get_password_hash  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402


def cmd_list(db, role: str | None) -> int:
    query = db.query(User)
    if role:
        query = query.filter(User.role == UserRole(role))
    users = query.order_by(User.id).all()

    if not users:
        print("No hay usuarios.")
        return 0

    print(f"{'id':>5}  {'email':45}  {'rol':10}  {'revisor':8}  doctor_status")
    print("-" * 90)
    for user in users:
        profile = getattr(user, "doctor_profile", None)
        doctor_status = profile.status.value if profile else "-"
        print(
            f"{user.id:>5}  {user.email:45}  {user.role.value:10}  "
            f"{str(bool(user.is_reviewer)):8}  {doctor_status}"
        )
    print("-" * 90)
    print(f"Total: {len(users)}")
    print("\nNota: las contraseñas no se pueden mostrar (bcrypt). Usa 'set-password' para asignar una.")
    return 0


def cmd_set_password(db, email: str, password: str) -> int:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"❌ No existe el usuario {email}")
        return 1
    if len(password) < 8:
        print("❌ La contraseña debe tener al menos 8 caracteres")
        return 1
    user.password_hash = get_password_hash(password)
    db.commit()
    print(f"✅ Contraseña actualizada para {email} (rol: {user.role.value})")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Lista usuarios y resetea contraseñas.")
    sub = parser.add_subparsers(dest="command", required=True)

    list_parser = sub.add_parser("list", help="Lista todos los usuarios")
    list_parser.add_argument("--role", choices=[r.value for r in UserRole], default=None)

    set_parser = sub.add_parser("set-password", help="Asigna una nueva contraseña a un usuario")
    set_parser.add_argument("email")
    set_parser.add_argument("password")

    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.command == "list":
            return cmd_list(db, args.role)
        if args.command == "set-password":
            return cmd_set_password(db, args.email, args.password)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
