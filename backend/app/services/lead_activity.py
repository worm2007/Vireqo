from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session, selectinload

from ..models import Appointment, AuditLog, Conversation, Lead, Task, User
from ..schemas import (
    AppointmentPublic,
    AuditLogPublic,
    ConversationPublic,
    LeadActivitySummary,
    LeadDetailResponse,
    LeadPrediction,
    LeadPublic,
    LeadTimelineItem,
    TaskPublic,
)
from .lead_scoring import calculate_lead_intelligence


def _as_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _parse_details(details: str) -> dict[str, Any]:
    if not details:
        return {}
    try:
        parsed = json.loads(details)
    except json.JSONDecodeError:
        return {"note": details}
    return parsed if isinstance(parsed, dict) else {"note": details}


def _humanize_action(action: str) -> str:
    label = action.replace("ai.", "AI ").replace("lead.", "Lead ").replace("appointment.", "Appointment ")
    return label.replace("_", " ").replace(".", " ").strip().title()


def _audit_description(audit: AuditLog) -> str:
    details = _parse_details(audit.details)
    if audit.action in {"lead.updated", "ai.lead_status_updated"}:
        old = details.get("from")
        new = details.get("to")
        if old and new:
            return f"Stage changed from {str(old).title()} to {str(new).title()}."
        fields = details.get("fields")
        if isinstance(fields, list) and fields:
            return f"Updated {', '.join(str(field).replace('_', ' ') for field in fields[:5])}."
        return "Lead details were updated."
    if audit.action in {"lead.created", "ai.lead_created"}:
        return "Opportunity was added to the workspace."
    if audit.action == "ai.appointment_created":
        starts_at = details.get("starts_at")
        return f"AI booked a meeting{f' for {starts_at}' if starts_at else ''}."
    if audit.action.startswith("ai."):
        return "AI completed a workspace action for this opportunity."
    return details.get("note") or audit.details or "Workspace activity recorded."


def _timeline_item(
    *,
    item_id: str,
    item_type: str,
    title: str,
    description: str,
    timestamp: datetime,
    tone: str = "neutral",
    metadata: dict[str, Any] | None = None,
) -> LeadTimelineItem:
    return LeadTimelineItem(
        id=item_id,
        type=item_type,
        title=title,
        description=description,
        timestamp=timestamp,
        tone=tone,
        metadata=metadata or {},
    )


def _relationship_health(lead: Lead, appointments: list[Appointment], conversations: list[Conversation], risks: list[str]) -> str:
    if lead.status == "won":
        return "Closed won"
    if lead.status == "lost":
        return "Closed lost"
    if any(appointment.status in {"booked", "confirmed"} for appointment in appointments):
        return "Meeting scheduled"
    if lead.status == "qualified" or lead.temperature == "hot":
        return "High intent"
    if risks:
        return "Needs attention"
    if conversations:
        return "Conversation active"
    return "Needs qualification"


def _risk_level(lead: Lead, prediction: LeadPrediction | None) -> tuple[str, str]:
    if lead.status == "lost":
        return "closed", "This opportunity is marked as lost."
    if lead.status == "won":
        return "won", "This opportunity is already won."
    if prediction and prediction.risks:
        level = "high" if prediction.next_action_priority == "high" else "medium"
        return level, prediction.risks[0]
    if not lead.budget or not lead.timeline:
        return "medium", "Budget or timeline is missing."
    return "low", "No major risk detected."


def build_lead_detail(db: Session, user: User, lead_id: str) -> LeadDetailResponse:
    business_id = user.business_id
    lead = db.scalar(select(Lead).where(Lead.id == lead_id, Lead.business_id == business_id))
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    appointments = list(
        db.scalars(
            select(Appointment)
            .where(Appointment.business_id == business_id, Appointment.lead_id == lead.id)
            .order_by(desc(Appointment.starts_at))
        ).all()
    )

    conversations = list(
        db.scalars(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.business_id == business_id, Conversation.lead_id == lead.id)
            .order_by(desc(Conversation.updated_at))
            .limit(10)
        ).all()
    )

    audits = list(
        db.scalars(
            select(AuditLog)
            .where(
                AuditLog.business_id == business_id,
                or_(
                    (AuditLog.entity_type == "lead") & (AuditLog.entity_id == lead.id),
                    AuditLog.details.contains(lead.id),
                ),
            )
            .order_by(desc(AuditLog.created_at))
            .limit(50)
        ).all()
    )

    tasks = list(
        db.scalars(
            select(Task)
            .where(Task.business_id == business_id, Task.lead_id == lead.id)
            .order_by(desc(Task.created_at))
            .limit(30)
        ).all()
    )

    intelligence = calculate_lead_intelligence(
        lead=lead,
        appointments=appointments,
        conversation_count=len(conversations),
    )
    prediction = LeadPrediction(
        lead_id=intelligence.lead_id,
        score=intelligence.score,
        temperature=intelligence.temperature,
        conversion_probability=intelligence.conversion_probability,
        conversion_label=intelligence.conversion_label,
        confidence=intelligence.confidence,
        next_action=intelligence.next_action,
        next_action_priority=intelligence.next_action_priority,
        reasons=intelligence.reasons,
        risks=intelligence.risks,
        signals=intelligence.signals,
        score_breakdown=intelligence.score_breakdown,
        estimated_budget_value=intelligence.estimated_budget_value,
    )

    timeline: list[LeadTimelineItem] = [
        _timeline_item(
            item_id=f"lead-created-{lead.id}",
            item_type="lead",
            title="Opportunity created",
            description=f"{lead.name} entered the pipeline from {lead.source or 'an unknown source'}.",
            timestamp=lead.created_at,
            tone="positive",
            metadata={"status": lead.status, "source": lead.source},
        )
    ]

    if lead.updated_at and lead.updated_at != lead.created_at:
        timeline.append(
            _timeline_item(
                item_id=f"lead-updated-{lead.id}",
                item_type="lead",
                title="Opportunity updated",
                description="Contact, qualification or pipeline details changed.",
                timestamp=lead.updated_at,
                tone="neutral",
                metadata={"status": lead.status, "score": lead.score},
            )
        )

    for appointment in appointments:
        starts_at = _as_aware(appointment.starts_at) or appointment.created_at
        title = "Meeting booked" if appointment.status in {"booked", "confirmed"} else "Appointment updated"
        timeline.append(
            _timeline_item(
                item_id=f"appointment-{appointment.id}",
                item_type="appointment",
                title=title,
                description=appointment.note or f"Appointment status: {appointment.status.replace('_', ' ')}.",
                timestamp=starts_at,
                tone="positive" if appointment.status in {"booked", "confirmed", "completed"} else "warning",
                metadata={"appointment_id": appointment.id, "status": appointment.status},
            )
        )

    for conversation in conversations:
        latest_message = conversation.messages[-1] if conversation.messages else None
        description = conversation.summary or (latest_message.content[:220] if latest_message else "Conversation linked to this lead.")
        timeline.append(
            _timeline_item(
                item_id=f"conversation-{conversation.id}",
                item_type="conversation",
                title="Conversation activity",
                description=description,
                timestamp=conversation.updated_at,
                tone="neutral",
                metadata={
                    "conversation_id": conversation.id,
                    "messages": len(conversation.messages),
                    "session_id": conversation.session_id,
                },
            )
        )

    for task in tasks:
        timestamp = task.completed_at or task.due_at or task.created_at
        status_label = task.status.replace("_", " ").title()
        timeline.append(
            _timeline_item(
                item_id=f"task-{task.id}",
                item_type="task",
                title=f"Task: {task.title}",
                description=task.description or f"{status_label} {task.priority} priority task.",
                timestamp=timestamp,
                tone="positive" if task.status == "completed" else ("warning" if task.priority in {"urgent", "high"} else "neutral"),
                metadata={"task_id": task.id, "status": task.status, "priority": task.priority},
            )
        )

    for audit in audits:
        timeline.append(
            _timeline_item(
                item_id=f"audit-{audit.id}",
                item_type="audit",
                title=_humanize_action(audit.action),
                description=_audit_description(audit),
                timestamp=audit.created_at,
                tone="positive" if audit.action.endswith("created") or audit.action.startswith("ai.") else "neutral",
                metadata={"action": audit.action, "entity_type": audit.entity_type, "entity_id": audit.entity_id},
            )
        )

    timeline.sort(key=lambda item: _as_aware(item.timestamp) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

    upcoming = [
        appointment for appointment in appointments
        if _as_aware(appointment.starts_at) and _as_aware(appointment.starts_at) >= datetime.now(timezone.utc)
        and appointment.status in {"booked", "confirmed"}
    ]
    upcoming.sort(key=lambda item: _as_aware(item.starts_at) or item.starts_at)

    latest_candidates = [lead.updated_at, lead.created_at]
    latest_candidates.extend(appointment.created_at for appointment in appointments)
    latest_candidates.extend(conversation.updated_at for conversation in conversations)
    latest_touch_at = max((_as_aware(item) for item in latest_candidates if item), default=None)

    risk_level, risk_reason = _risk_level(lead, prediction)
    summary = LeadActivitySummary(
        activity_count=len(timeline),
        latest_touch_at=latest_touch_at,
        upcoming_meeting_at=upcoming[0].starts_at if upcoming else None,
        relationship_health=_relationship_health(lead, appointments, conversations, prediction.risks),
        risk_level=risk_level,
        risk_reason=risk_reason,
        next_action=prediction.next_action,
        appointment_count=len(appointments),
        conversation_count=len(conversations),
        audit_count=len(audits),
        task_count=len(tasks),
    )

    return LeadDetailResponse(
        lead=LeadPublic.model_validate(lead),
        prediction=prediction,
        summary=summary,
        appointments=[AppointmentPublic.model_validate(item) for item in appointments],
        conversations=[ConversationPublic.model_validate(item) for item in conversations],
        audits=[AuditLogPublic.model_validate(item) for item in audits],
        tasks=[TaskPublic.model_validate(item) for item in tasks],
        timeline=timeline[:80],
    )
