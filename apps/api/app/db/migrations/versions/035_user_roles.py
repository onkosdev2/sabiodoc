"""Roles múltiples por usuario (many-to-many)

Revision ID: 035
Revises: 034
Create Date: 2026-10-12 00:00:00.000000

Reemplaza el modelo de un solo ``users.role`` + flag ``is_reviewer`` por una
tabla de unión ``user_roles``. ``patient`` es el rol base de toda cuenta y
``doctor``/``reviewer``/``admin`` son roles sumables.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "035"
down_revision = "034"
branch_labels = None
depends_on = None

_USERROLE = postgresql.ENUM(
    "patient", "doctor", "reviewer", "admin", name="userrole", create_type=False
)


def upgrade() -> None:
    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", _USERROLE, nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "role"),
    )
    op.create_index(op.f("ix_user_roles_role"), "user_roles", ["role"], unique=False)

    # Backfill: rol base -> rol anterior -> capacidad de revisor.
    op.execute(
        "INSERT INTO user_roles (user_id, role) "
        "SELECT id, role FROM users ON CONFLICT DO NOTHING"
    )
    op.execute(
        "INSERT INTO user_roles (user_id, role) "
        "SELECT id, 'reviewer' FROM users WHERE is_reviewer = true "
        "ON CONFLICT DO NOTHING"
    )
    op.execute(
        "INSERT INTO user_roles (user_id, role) "
        "SELECT id, 'patient' FROM users ON CONFLICT DO NOTHING"
    )

    op.drop_column("users", "is_reviewer")
    op.drop_column("users", "role")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "role",
            _USERROLE,
            nullable=False,
            server_default="patient",
        ),
    )
    op.add_column(
        "users",
        sa.Column("is_reviewer", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # Rol primario por precedencia admin > doctor > reviewer > patient.
    op.execute(
        """
        UPDATE users SET role = ranked.role
        FROM (
            SELECT user_id, role,
                   row_number() OVER (
                       PARTITION BY user_id
                       ORDER BY CASE role
                           WHEN 'admin' THEN 1
                           WHEN 'doctor' THEN 2
                           WHEN 'reviewer' THEN 3
                           ELSE 4
                       END
                   ) AS rn
            FROM user_roles
        ) AS ranked
        WHERE ranked.user_id = users.id AND ranked.rn = 1
        """
    )
    op.execute(
        "UPDATE users SET is_reviewer = true "
        "WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'reviewer')"
    )

    op.drop_index(op.f("ix_user_roles_role"), table_name="user_roles")
    op.drop_table("user_roles")
