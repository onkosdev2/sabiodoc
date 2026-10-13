import enum
from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class UserRole(str, enum.Enum):
    patient = "patient"
    doctor = "doctor"
    reviewer = "reviewer"
    admin = "admin"
    support = "support"


# Orden de precedencia para elegir el "rol primario" que se muestra en la API.
ROLE_PRECEDENCE: tuple[UserRole, ...] = (
    UserRole.admin,
    UserRole.doctor,
    UserRole.reviewer,
    UserRole.support,
    UserRole.patient,
)

# Rol base: toda cuenta puede actuar como paciente.
BASE_ROLE = UserRole.patient


def sorted_roles(roles) -> list[UserRole]:
    """Ordena los roles por precedencia (admin, doctor, reviewer, patient)."""
    order = {role: index for index, role in enumerate(ROLE_PRECEDENCE)}
    return sorted(set(roles), key=lambda role: order.get(role, 99))


class UserRoleAssignment(Base):
    """Asignación de un rol a un usuario (tabla de unión ``user_roles``).

    Un usuario puede tener varios roles a la vez; ``patient`` es el rol base que
    siempre está presente. Los roles de ``doctor``/``reviewer``/``admin`` son
    capacidades sumables.
    """

    __tablename__ = "user_roles"

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role = Column(Enum(UserRole, name="userrole"), primary_key=True, index=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    # La cuenta debe verificar su correo antes de iniciar sesión (excepto cuentas
    # creadas por admin/seed o cuando la verificación está desactivada).
    is_email_verified = Column(Boolean, nullable=False, server_default="true", default=True)
    # Se incrementa al cambiar la contraseña para invalidar los tokens emitidos.
    session_version = Column(Integer, nullable=False, server_default="1")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    role_assignments = relationship(
        "UserRoleAssignment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # ------------------------------------------------------------------
    # Ayudas de roles
    # ------------------------------------------------------------------
    @property
    def roles(self) -> set[UserRole]:
        return {assignment.role for assignment in self.role_assignments}

    def has_role(self, role: UserRole) -> bool:
        return role in self.roles

    def has_any_role(self, *roles: UserRole) -> bool:
        current = self.roles
        return any(role in current for role in roles)

    def set_roles(self, roles) -> None:
        """Reemplaza los roles conservando siempre el rol base ``patient``."""
        normalized = {BASE_ROLE} | {role for role in roles}
        existing = {assignment.role: assignment for assignment in self.role_assignments}
        for role, assignment in list(existing.items()):
            if role not in normalized:
                self.role_assignments.remove(assignment)
        for role in normalized:
            if role not in existing:
                self.role_assignments.append(UserRoleAssignment(role=role))

    def add_role(self, role: UserRole) -> None:
        if not self.has_role(role):
            self.role_assignments.append(UserRoleAssignment(role=role))

    def remove_role(self, role: UserRole) -> None:
        if role == BASE_ROLE:
            return
        for assignment in list(self.role_assignments):
            if assignment.role == role:
                self.role_assignments.remove(assignment)

    @property
    def primary_role(self) -> UserRole:
        current = self.roles
        for role in ROLE_PRECEDENCE:
            if role in current:
                return role
        return BASE_ROLE

    @property
    def is_admin(self) -> bool:
        return self.has_role(UserRole.admin)

    @property
    def is_doctor(self) -> bool:
        return self.has_role(UserRole.doctor)

    @property
    def is_reviewer(self) -> bool:
        return self.has_role(UserRole.reviewer)

    @property
    def is_support(self) -> bool:
        return self.has_role(UserRole.support)

    @property
    def is_patient(self) -> bool:
        return self.has_role(UserRole.patient)
