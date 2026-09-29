"""Traduce textos en inglés ya guardados en notificaciones

Revision ID: 029
Revises: 028
Create Date: 2026-10-10 00:00:00.000000

Las notificaciones de revisión de postulaciones guardaban el valor interno del
estado (pending/approved/rejected/suspended) y algunas con "no-show". Las
corrige a español para las filas que ya existían.
"""
from alembic import op


revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


_BODY_REPLACEMENTS = [
    ("marcado como approved", "marcado como aprobado"),
    ("marcado como pending", "marcado como pendiente"),
    ("marcado como rejected", "marcado como rechazado"),
    ("marcado como suspended", "marcado como suspendido"),
    ("Tu perfil medico", "Tu perfil médico"),
    ("Cita marcada como no-show", "Cita marcada como inasistencia"),
]

_TITLE_REPLACEMENTS = [
    ("Actualizacion de postulacion", "Actualización de postulación"),
    ("Cita marcada como no-show", "Cita marcada como inasistencia"),
]


def upgrade() -> None:
    connection = op.get_bind()
    for old, new in _BODY_REPLACEMENTS:
        if old == new:
            continue
        connection.exec_driver_sql(
            "UPDATE notifications SET body = REPLACE(body, %s, %s) WHERE body LIKE %s",
            (old, new, f"%{old}%"),
        )
    for old, new in _TITLE_REPLACEMENTS:
        connection.exec_driver_sql(
            "UPDATE notifications SET title = REPLACE(title, %s, %s) WHERE title LIKE %s",
            (old, new, f"%{old}%"),
        )


def downgrade() -> None:
    connection = op.get_bind()
    for old, new in _BODY_REPLACEMENTS:
        if old == new:
            continue
        connection.exec_driver_sql(
            "UPDATE notifications SET body = REPLACE(body, %s, %s) WHERE body LIKE %s",
            (new, old, f"%{new}%"),
        )
    for old, new in _TITLE_REPLACEMENTS:
        connection.exec_driver_sql(
            "UPDATE notifications SET title = REPLACE(title, %s, %s) WHERE title LIKE %s",
            (new, old, f"%{new}%"),
        )
