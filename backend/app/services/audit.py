from __future__ import annotations

import json
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from ..models import AuditLog, User


def client_ip(request: Request | None) -> str:
    if request is None:
        return ""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


def record_audit(
    db: Session,
    *,
    action: str,
    user: User | None = None,
    business_id: str | None = None,
    entity_type: str = "",
    entity_id: str = "",
    details: dict[str, Any] | str | None = None,
    request: Request | None = None,
) -> None:
    if isinstance(details, dict):
        detail_text = json.dumps(details, separators=(",", ":"), default=str)
    else:
        detail_text = details or ""
    db.add(
        AuditLog(
            business_id=business_id or (user.business_id if user else None),
            user_id=user.id if user else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=detail_text,
            ip_address=client_ip(request),
        )
    )
