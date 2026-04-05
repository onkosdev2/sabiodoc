import json

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


class AuditService:
    def log(
        self,
        db: Session,
        *,
        action: str,
        entity_type: str,
        entity_id: int | None = None,
        actor_user_id: int | None = None,
        metadata: dict | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=json.dumps(metadata or {}, ensure_ascii=True),
        )
        db.add(entry)
        db.flush()
        return entry


audit_service = AuditService()
