from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Appointment, AuditLog, AuthToken, Business, Conversation, Lead, Message, Task, User, utcnow
from ..schemas import AccountDeleteRequest, AccountExportSummary, UserProfileUpdate, UserPublic
from ..security import get_current_user, hash_opaque_token, verify_password
from ..services.audit import record_audit

router = APIRouter(prefix="/account", tags=["Account"])

DELETE_CONFIRMATION = "DELETE MY WORKSPACE"


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _business_payload(business: Business) -> dict[str, Any]:
    return {
        "id": business.id,
        "name": business.name,
        "slug": business.slug,
        "industry": business.industry,
        "description": business.description,
        "website": business.website,
        "brand_color": business.brand_color,
        "greeting": business.greeting,
        "created_at": _iso(business.created_at),
    }


def _user_payload(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "is_email_verified": user.is_email_verified,
        "email_verified_at": _iso(user.email_verified_at),
        "created_at": _iso(user.created_at),
    }


def _lead_payload(lead: Lead) -> dict[str, Any]:
    return {
        "id": lead.id,
        "name": lead.name,
        "email": lead.email,
        "phone": lead.phone,
        "company": lead.company,
        "need": lead.need,
        "budget": lead.budget,
        "timeline": lead.timeline,
        "source": lead.source,
        "status": lead.status,
        "score": lead.score,
        "temperature": lead.temperature,
        "notes": lead.notes,
        "created_at": _iso(lead.created_at),
        "updated_at": _iso(lead.updated_at),
    }


def _appointment_payload(appointment: Appointment) -> dict[str, Any]:
    return {
        "id": appointment.id,
        "lead_id": appointment.lead_id,
        "name": appointment.name,
        "email": appointment.email,
        "phone": appointment.phone,
        "starts_at": _iso(appointment.starts_at),
        "status": appointment.status,
        "note": appointment.note,
        "created_at": _iso(appointment.created_at),
    }


def _message_payload(message: Message) -> dict[str, Any]:
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "created_at": _iso(message.created_at),
    }


def _conversation_payload(conversation: Conversation) -> dict[str, Any]:
    return {
        "id": conversation.id,
        "lead_id": conversation.lead_id,
        "session_id": conversation.session_id,
        "summary": conversation.summary,
        "created_at": _iso(conversation.created_at),
        "updated_at": _iso(conversation.updated_at),
        "messages": [_message_payload(message) for message in conversation.messages],
    }


def _task_payload(task: Task) -> dict[str, Any]:
    return {
        "id": task.id,
        "lead_id": task.lead_id,
        "created_by_id": task.created_by_id,
        "title": task.title,
        "description": task.description,
        "priority": task.priority,
        "status": task.status,
        "source": task.source,
        "due_at": _iso(task.due_at),
        "completed_at": _iso(task.completed_at),
        "created_at": _iso(task.created_at),
        "updated_at": _iso(task.updated_at),
    }


def _audit_payload(log: AuditLog) -> dict[str, Any]:
    return {
        "id": log.id,
        "user_id": log.user_id,
        "action": log.action,
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "details": log.details,
        "ip_address": log.ip_address,
        "created_at": _iso(log.created_at),
    }


@router.patch("/profile", response_model=UserPublic)
def update_profile(
    payload: UserProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    current_user.name = payload.name.strip()
    record_audit(
        db,
        action="account.profile_updated",
        user=current_user,
        entity_type="user",
        entity_id=current_user.id,
        details={"fields": ["name"]},
        request=request,
    )
    db.commit()
    db.refresh(current_user)
    current_user = db.scalar(select(User).options(selectinload(User.business)).where(User.id == current_user.id))
    assert current_user is not None
    return current_user


@router.get("/export/summary", response_model=AccountExportSummary)
def export_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccountExportSummary:
    business_id = current_user.business_id
    return AccountExportSummary(
        generated_at=utcnow(),
        users=len(db.scalars(select(User).where(User.business_id == business_id)).all()),
        leads=len(db.scalars(select(Lead).where(Lead.business_id == business_id)).all()),
        conversations=len(db.scalars(select(Conversation).where(Conversation.business_id == business_id)).all()),
        appointments=len(db.scalars(select(Appointment).where(Appointment.business_id == business_id)).all()),
        tasks=len(db.scalars(select(Task).where(Task.business_id == business_id)).all()),
        audit_logs=len(db.scalars(select(AuditLog).where(AuditLog.business_id == business_id)).all()),
    )


@router.get("/export")
def export_account_data(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    business_id = current_user.business_id
    business = current_user.business
    users = db.scalars(select(User).where(User.business_id == business_id).order_by(User.created_at.desc())).all()
    leads = db.scalars(select(Lead).where(Lead.business_id == business_id).order_by(Lead.created_at.desc())).all()
    appointments = db.scalars(
        select(Appointment).where(Appointment.business_id == business_id).order_by(Appointment.starts_at.desc())
    ).all()
    conversations = db.scalars(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.business_id == business_id)
        .order_by(Conversation.updated_at.desc())
    ).all()
    tasks = db.scalars(select(Task).where(Task.business_id == business_id).order_by(Task.created_at.desc())).all()
    audits = db.scalars(select(AuditLog).where(AuditLog.business_id == business_id).order_by(AuditLog.created_at.desc())).all()

    record_audit(
        db,
        action="account.data_exported",
        user=current_user,
        entity_type="business",
        entity_id=business_id,
        request=request,
    )
    db.commit()

    return {
        "generated_at": _iso(utcnow()),
        "format": "vireqo.account_export.v1",
        "business": _business_payload(business),
        "users": [_user_payload(user) for user in users],
        "leads": [_lead_payload(lead) for lead in leads],
        "appointments": [_appointment_payload(appointment) for appointment in appointments],
        "conversations": [_conversation_payload(conversation) for conversation in conversations],
        "tasks": [_task_payload(task) for task in tasks],
        "audit_logs": [_audit_payload(log) for log in audits],
    }


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    payload: AccountDeleteRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if current_user.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the workspace owner can delete this workspace")
    if payload.confirmation.strip() != DELETE_CONFIRMATION:
        raise HTTPException(status_code=400, detail=f'Type "{DELETE_CONFIRMATION}" to confirm deletion')
    if not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Password is incorrect")

    business = db.scalar(select(Business).where(Business.id == current_user.business_id))
    if not business:
        raise HTTPException(status_code=404, detail="Workspace not found")

    record_audit(
        db,
        action="account.workspace_deleted",
        user=current_user,
        entity_type="business",
        entity_id=business.id,
        details={"business_name": business.name, "requested_by": current_user.email},
        request=request,
    )
    db.flush()

    # Revoke opaque auth tokens before deleting the business. Cascades remove users and workspace data.
    user_ids = [user.id for user in db.scalars(select(User).where(User.business_id == business.id)).all()]
    if user_ids:
        db.execute(delete(AuthToken).where(AuthToken.user_id.in_(user_ids)))
    db.delete(business)
    db.commit()
