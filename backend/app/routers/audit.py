from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AuditLog, User
from ..schemas import AuditLogPublic
from ..security import require_roles

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("", response_model=list[AuditLogPublic])
def list_audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> list[AuditLog]:
    return list(
        db.scalars(
            select(AuditLog)
            .where(AuditLog.business_id == current_user.business_id)
            .order_by(desc(AuditLog.created_at))
            .limit(limit)
        ).all()
    )
